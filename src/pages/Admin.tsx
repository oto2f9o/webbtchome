import React, { useState, useEffect } from 'react';
import { db, doc, setDoc, deleteDoc, collection, onSnapshot, query, orderBy } from '../lib/firebase';
import { Loader2, Plus, Users, Copy, Check, Trash2, Upload, FileJson, ChevronDown, ChevronUp, History, Clock } from 'lucide-react';

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  
  const [creationMode, setCreationMode] = useState<'ai' | 'manual'>('ai');
  const [topic, setTopic] = useState('');
  const [questionCount, setQuestionCount] = useState(5);
  const [manualJson, setManualJson] = useState('');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  
  const [activeQuiz, setActiveQuiz] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [quizHistory, setQuizHistory] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'devbyandz') {
      setIsAuthenticated(true);
    } else {
      setError('Sai mật khẩu!');
    }
  };

  const generateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    
    setIsGenerating(true);
    setError('');
    
    try {
      const res = await fetch('/api/admin/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, count: questionCount })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi tạo câu hỏi');
      
      const quizData = {
        inviteCode: data.inviteCode,
        topic,
        questions: data.questions,
        createdAt: Date.now()
      };
      
      // Save to Firebase
      await setDoc(doc(db, 'quizzes', data.inviteCode), quizData);
      setActiveQuiz(quizData);
      setTopic('');
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        setManualJson(JSON.stringify(parsed, null, 2));
        setError('');
      } catch (err) {
        setError('File không hợp lệ. Vui lòng tải lên file JSON đúng định dạng.');
      }
    };
    reader.readAsText(file);
  };

  const createManualQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    setError('');
    
    try {
      const questions = JSON.parse(manualJson);
      if (!Array.isArray(questions)) throw new Error('Dữ liệu phải là một mảng (Array) các câu hỏi.');
      if (questions.length === 0) throw new Error('Danh sách câu hỏi trống.');
      
      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const quizData = {
        inviteCode,
        topic,
        questions,
        createdAt: Date.now()
      };
      
      await setDoc(doc(db, 'quizzes', inviteCode), quizData);
      setActiveQuiz(quizData);
      setTopic('');
      setManualJson('');
    } catch (err: any) {
      setError('Lỗi dữ liệu JSON: ' + err.message);
    }
  };

  const deleteQuiz = async () => {
    if (!activeQuiz) return;
    if (!window.confirm('Bạn có chắc chắn muốn xóa bài thi này không? Toàn bộ dữ liệu của học sinh sẽ bị mất.')) return;
    
    try {
      await deleteDoc(doc(db, 'quizzes', activeQuiz.inviteCode));
      setActiveQuiz(null);
      setLeaderboard([]);
    } catch (err) {
      alert('Không thể xóa bài thi: ' + err);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    
    const q = query(collection(db, 'quizzes'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setQuizHistory(history);
      
      setActiveQuiz(current => {
        if (!current && history.length > 0) {
          return history[0];
        }
        return current;
      });
    });
    
    return () => unsubscribe();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!activeQuiz) return;
    
    // Setup listener for leaderboard
    const q = query(
      collection(db, 'quizzes', activeQuiz.inviteCode, 'scores'),
      orderBy('score', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const scores = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLeaderboard(scores);
    });
    
    return () => unsubscribe();
  }, [activeQuiz]);

  const copyInviteCode = () => {
    if (activeQuiz) {
      navigator.clipboard.writeText(activeQuiz.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
          <h1 className="text-2xl font-bold text-center mb-6 text-neutral-800">Cổng Admin Giáo Viên</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-600 mb-1">Mật khẩu</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="Nhập mật khẩu..."
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button type="submit" className="w-full bg-blue-600 text-white font-medium p-3 rounded-xl hover:bg-blue-700 transition">
              Đăng Nhập
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        <header className="bg-white p-6 rounded-2xl shadow-sm flex flex-col md:flex-row items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-800">Bảng điều khiển Giáo viên</h1>
            <p className="text-neutral-500 text-sm mt-1">Dữ liệu sẽ tự động được xóa sau 24 giờ để tối ưu chi phí.</p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-500" /> Tạo bài thi mới
              </h2>
              
              <div className="flex bg-neutral-100 p-1 rounded-lg mb-6">
                <button
                  onClick={() => setCreationMode('ai')}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition ${creationMode === 'ai' ? 'bg-white shadow-sm text-blue-600' : 'text-neutral-500 hover:text-neutral-700'}`}
                >
                  Dùng AI
                </button>
                <button
                  onClick={() => setCreationMode('manual')}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition ${creationMode === 'manual' ? 'bg-white shadow-sm text-blue-600' : 'text-neutral-500 hover:text-neutral-700'}`}
                >
                  Tự soạn
                </button>
              </div>

              {creationMode === 'ai' ? (
                <form onSubmit={generateQuiz} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-600 mb-1">Chủ đề bài thi</label>
                    <input
                      type="text"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="VD: Lịch sử Việt Nam thế kỷ 20"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-600 mb-1">Số lượng câu hỏi (Tối đa 20)</label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={questionCount}
                      onChange={(e) => setQuestionCount(Number(e.target.value))}
                      className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  {error && <p className="text-red-500 text-sm font-medium">{error}</p>}
                  <button
                    type="submit"
                    disabled={isGenerating}
                    className="w-full bg-neutral-900 text-white font-medium p-3 rounded-xl hover:bg-neutral-800 transition flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Tạo bằng AI (FreeLLM)'}
                  </button>
                  <p className="text-xs text-neutral-500 text-center mt-2">Giới hạn: 30 bài thi / phút</p>
                </form>
              ) : (
                <form onSubmit={createManualQuiz} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-600 mb-1">Chủ đề bài thi</label>
                    <input
                      type="text"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="VD: Bài kiểm tra Toán học"
                      required
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-sm font-medium text-neutral-600">Nội dung JSON</label>
                      <label className="text-xs text-blue-600 hover:underline cursor-pointer flex items-center gap-1">
                        <Upload className="w-3 h-3" /> Upload File JSON
                        <input type="file" accept=".json" className="hidden" onChange={handleFileUpload} />
                      </label>
                    </div>
                    <textarea
                      value={manualJson}
                      onChange={(e) => setManualJson(e.target.value)}
                      className="w-full p-3 border border-neutral-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs h-40 resize-none"
                      placeholder={`[\n  {\n    "question": "Câu hỏi?",\n    "options": ["A", "B", "C", "D"],\n    "correctAnswer": 0\n  }\n]`}
                      required
                    />
                  </div>
                  {error && <p className="text-red-500 text-sm font-medium">{error}</p>}
                  <button
                    type="submit"
                    className="w-full bg-blue-600 text-white font-medium p-3 rounded-xl hover:bg-blue-700 transition flex justify-center items-center gap-2"
                  >
                    <FileJson className="w-5 h-5" /> Lưu bài thi
                  </button>
                </form>
              )}
            </div>
            
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <History className="w-5 h-5 text-neutral-500" /> Lịch sử đề thi
              </h2>
              
              {quizHistory.length === 0 ? (
                <p className="text-sm text-neutral-500 text-center py-4">Chưa có đề thi nào.</p>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {quizHistory.map(quiz => (
                    <div 
                      key={quiz.id}
                      onClick={() => setActiveQuiz(quiz)}
                      className={`p-3 rounded-xl border cursor-pointer transition ${
                        activeQuiz?.inviteCode === quiz.inviteCode 
                          ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-500' 
                          : 'bg-neutral-50 border-transparent hover:bg-neutral-100 hover:border-neutral-200'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-sm text-neutral-800 line-clamp-2">{quiz.topic}</h4>
                      </div>
                      <div className="flex justify-between items-center text-xs text-neutral-500">
                        <span className="font-mono bg-white px-2 py-1 rounded border border-neutral-200 text-blue-600 font-semibold">{quiz.inviteCode}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(quiz.createdAt).toLocaleDateString('vi-VN')} {new Date(quiz.createdAt).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            {activeQuiz ? (
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-neutral-800">Bài thi: {activeQuiz.topic}</h2>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-neutral-500">Mã Mời:</span>
                      <span className="px-3 py-1 bg-blue-100 text-blue-800 font-mono font-bold rounded-lg tracking-widest text-lg">
                        {activeQuiz.inviteCode}
                      </span>
                      <button onClick={copyInviteCode} className="text-neutral-500 hover:text-blue-600 transition" title="Copy mã mời">
                        {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                      </button>
                      
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <div className="flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-xl text-sm font-medium">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                      </span>
                      Đang nhận kết quả trực tiếp
                    </div>
                    <button 
                      onClick={deleteQuiz} 
                      className="flex items-center gap-2 bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2 rounded-xl text-sm font-medium transition"
                      title="Xóa bài thi"
                    >
                      <Trash2 className="w-4 h-4" />
                      Xóa
                    </button>
                  </div>
                </div>

                <div className="border-t border-neutral-100 pt-6">
                  <h3 className="font-semibold text-neutral-800 flex items-center gap-2 mb-4">
                    <Users className="w-5 h-5" /> Bảng Xếp Hạng ({leaderboard.length}/50 học sinh)
                  </h3>
                  
                  {leaderboard.length === 0 ? (
                    <div className="text-center py-10 text-neutral-500 bg-neutral-50 rounded-xl border border-dashed border-neutral-200">
                      Chưa có học sinh nào nộp bài. Gửi mã mời cho học sinh để bắt đầu.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {leaderboard.map((student, idx) => (
                        <div 
                          key={student.id} 
                          className="flex flex-col bg-neutral-50 hover:bg-neutral-100 transition rounded-xl overflow-hidden cursor-pointer border border-transparent hover:border-neutral-200"
                          onClick={() => setExpandedStudentId(expandedStudentId === student.id ? null : student.id)}
                        >
                          <div className="flex items-center justify-between p-4 gap-4">
                            <div className="flex items-center gap-4 flex-shrink-0">
                              <span className="text-lg font-bold text-neutral-400 w-6 text-center">#{idx + 1}</span>
                              <span className="font-medium text-neutral-900 flex items-center gap-2">
                                {student.name}
                                {expandedStudentId === student.id ? (
                                  <ChevronUp className="w-4 h-4 text-neutral-400" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-neutral-400" />
                                )}
                              </span>
                            </div>
                            
                            <span className="font-bold text-blue-600 text-lg flex-shrink-0">{student.score} đ</span>
                          </div>
                          
                          {expandedStudentId === student.id && (
                            <div className="px-4 pb-4 pt-1">
                              <div className="bg-white p-4 rounded-lg border border-neutral-200 shadow-sm text-sm text-neutral-700 italic relative">
                                <div className="absolute -top-2 left-6 w-4 h-4 bg-white border-t border-l border-neutral-200 transform rotate-45"></div>
                                {student.aiFeedback ? (
                                  <span className="relative z-10">{student.aiFeedback}</span>
                                ) : (
                                  <span className="text-neutral-400 relative z-10 flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin" /> AI đang sinh nhận xét...
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center bg-neutral-50 border border-dashed border-neutral-300 rounded-2xl p-10 text-center">
                <div className="max-w-sm">
                  <h3 className="text-lg font-semibold text-neutral-700 mb-2">Chưa có bài thi nào</h3>
                  <p className="text-neutral-500">Hãy nhập chủ đề bên trái và nhấn Tạo bằng AI để bắt đầu một bài kiểm tra mới cho học sinh.</p>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
