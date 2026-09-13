import express from 'express';
import { createServer as createViteServer } from 'vite';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import OpenAI from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const app = express();

// Trust proxy for express-rate-limit behind Cloud Run
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());

// FreeLLM API Key: process.env.FREELLM_API_KEY
// Base URL: process.env.NEXT_PUBLIC_FREELLM_BASE_URL

const openai = new OpenAI({
  baseURL: process.env.NEXT_PUBLIC_FREELLM_BASE_URL || "http://127.0.0.1:31415/v1",
  apiKey: process.env.FREELLM_API_KEY || "local-key"
});

const teacherLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Quá giới hạn tạo câu hỏi. Vui lòng chờ 1 phút (Tối đa 30 requests/phút).' }
});

const studentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { error: 'Hệ thống đang quá tải. Vui lòng thử lại sau (Tối đa 200 requests/phút).' }
});

  app.post('/api/admin/generate-quiz', teacherLimiter, async (req, res) => {
    try {
      const { topic, count } = req.body;
      if (!topic) return res.status(400).json({ error: 'Missing topic' });
  
      const countToGen = parseInt(count) || 5;
  
      const completion = await openai.chat.completions.create({
        model: process.env.FREELLM_MODEL || 'auto', // Dùng tên model mặc định hoặc lấy từ biến môi trường
        messages: [
          { role: 'system', content: `Bạn là giáo viên. Bạn phải trả về kết quả dưới dạng JSON object chứa duy nhất thuộc tính "questions". "questions" là một mảng gồm ${countToGen} câu hỏi trắc nghiệm. Mỗi câu hỏi phải có: "question" (chuỗi), "options" (mảng 4 chuỗi đáp án), và "correctAnswer" (số nguyên từ 0-3 là index của đáp án đúng).` },
          { role: 'user', content: `Hãy tạo ${countToGen} câu hỏi trắc nghiệm về chủ đề: "${topic}".` }
        ],
        response_format: { type: 'json_object' }
      });
  
      const parsed = JSON.parse(completion.choices[0].message?.content || '{}');
      const quizData = parsed.questions || [];
      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      res.json({ inviteCode, questions: quizData });
    } catch (err: any) {
      if (err.message && err.message.includes('ECONNREFUSED')) {
        return res.status(502).json({ error: 'Không thể kết nối đến AI Router. Vui lòng kiểm tra lại cấu hình NEXT_PUBLIC_FREELLM_BASE_URL (chắc chắn bạn đã dùng Ngrok hoặc cấu hình HTTPS public) và đảm bảo Router đang chạy.' });
      }
      if (err.status === 401 || (err.message && err.message.toLowerCase().includes('invalid api key')) || (err.message && err.message.toLowerCase().includes('authentication'))) {
        return res.status(401).json({ error: 'Sai API Key. Vui lòng kiểm tra lại FREELLM_API_KEY trong cấu hình Secrets.' });
      }
      if (err.status === 404 || (err.message && err.message.includes('not in the catalog'))) {
        return res.status(404).json({ error: 'Lỗi 404: Tên Model bị sai. Bạn đang nhập mã API Key vào ô cấu hình FREELLM_MODEL. Hãy xóa biến FREELLM_MODEL đi để hệ thống tự auto-route, hoặc điền đúng tên model (vd: gemini-1.5-pro).' });
      }
      if (err.status === 503 || (err.message && err.message.includes('usable provider key'))) {
        return res.status(503).json({ error: 'Lỗi 503 từ FreeLLM: Model không hợp lệ hoặc chưa có API Key của nhà cung cấp. Vui lòng cấu hình FREELLM_MODEL (vd: gemini-1.5-pro, claude-3-haiku) trong mục Secrets hoặc kiểm tra lại bảng điều khiển FreeLLM.' });
      }
      if (err.status === 429 || (err.message && err.message.includes('429')) || (err.message && err.message.toLowerCase().includes('quota')) || (err.message && err.message.toLowerCase().includes('too_many_requests'))) {
        return res.status(429).json({ error: 'Hết lượt sử dụng AI (Quota exceeded). Vui lòng cập nhật API Key hoặc chờ một lát rồi thử lại.' });
      }
      console.error(err);
      res.status(500).json({ error: err.message || 'Lỗi server' });
    }
  });

app.post('/api/student/feedback', studentLimiter, async (req, res) => {
  try {
    const { name, score, totalQuestions } = req.body;
    
    const maxPoints = totalQuestions * 700;
    const minPointsIfAllCorrect = totalQuestions * 100;
    
    const completion = await openai.chat.completions.create({
      model: process.env.FREELLM_MODEL || 'auto',
      messages: [
        { role: 'system', content: 'Bạn là một trợ lý giáo viên nhận xét kết quả thi trắc nghiệm. Quy tắc tính điểm: Mỗi câu trả lời đúng được từ 100 đến 700 điểm tùy tốc độ, trả lời sai được 0 điểm.' },
        { role: 'user', content: `Học sinh tên "${name}" đạt tổng cộng ${score} điểm trong bài thi gồm ${totalQuestions} câu hỏi. Điểm tối đa tuyệt đối là ${maxPoints} điểm (tức là đúng toàn bộ và nhanh nhất). Dựa vào số điểm ${score}/${maxPoints} này, hãy phân tích độ chính xác và tốc độ để viết một đoạn nhận xét ngắn gọn (2-3 câu) bằng tiếng Việt động viên và khuyên học sinh. Trả lời trực tiếp nội dung nhận xét.` }
      ]
    });

    res.json({ feedback: completion.choices[0].message?.content || "" });
  } catch (err: any) {
    if (err.message && err.message.includes('ECONNREFUSED')) {
      return res.status(502).json({ error: 'Không thể kết nối đến AI Router. Vui lòng kiểm tra lại cấu hình NEXT_PUBLIC_FREELLM_BASE_URL (chắc chắn bạn đã dùng Ngrok hoặc cấu hình HTTPS public) và đảm bảo Router đang chạy.' });
    }
    if (err.status === 401 || (err.message && err.message.toLowerCase().includes('invalid api key')) || (err.message && err.message.toLowerCase().includes('authentication'))) {
      return res.status(401).json({ error: 'Sai API Key. Vui lòng kiểm tra lại FREELLM_API_KEY trong cấu hình Secrets.' });
    }
    if (err.status === 404 || (err.message && err.message.includes('not in the catalog'))) {
      return res.status(404).json({ error: 'Lỗi 404: Tên Model bị sai. Bạn đang nhập mã API Key vào ô cấu hình FREELLM_MODEL. Hãy xóa biến FREELLM_MODEL đi để hệ thống tự auto-route, hoặc điền đúng tên model (vd: gemini-1.5-pro).' });
    }
    if (err.status === 503 || (err.message && err.message.includes('usable provider key'))) {
      return res.status(503).json({ error: 'Lỗi 503 từ FreeLLM: Model không hợp lệ hoặc chưa có API Key của nhà cung cấp. Vui lòng cấu hình FREELLM_MODEL (vd: gemini-1.5-pro, claude-3-haiku) trong mục Secrets hoặc kiểm tra lại bảng điều khiển FreeLLM.' });
    }
    if (err.status === 429 || (err.message && err.message.includes('429')) || (err.message && err.message.toLowerCase().includes('quota')) || (err.message && err.message.toLowerCase().includes('too_many_requests'))) {
      return res.status(429).json({ error: 'Hết lượt sử dụng AI (Quota exceeded). Vui lòng cập nhật API Key hoặc chờ một lát rồi thử lại.' });
    }
    console.error(err);
    res.status(500).json({ error: err.message || 'Lỗi server' });
  }
});

async function startServer() {
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // __dirname is dist/ when running built server.js
    const clientPath = path.resolve(__dirname, 'client');
    app.use(express.static(clientPath));
    app.use('*', (req, res) => {
      res.sendFile(path.resolve(clientPath, 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server started on port ${PORT}`);
  });
}

startServer();
