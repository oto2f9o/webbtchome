import React, { useState, useEffect } from 'react';
import { db, doc, getDoc, setDoc } from '../lib/firebase';
import { Loader2, ArrowRight, Trophy, Sparkles } from 'lucide-react';

export default function Student() {
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [quiz, setQuiz] = useState<any>(null);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [pointsPossible, setPointsPossible] = useState(700);
  
  const [isFinished, setIsFinished] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [loadingFeedback, setLoadingFeedback] = useState(false);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !inviteCode.trim()) return;
    
    setLoading(true);
    setError('');
    const code = inviteCode.toUpperCase();
    
    try {
      const quizRef = doc(db, 'quizzes', code);
      const quizSnap = await getDoc(quizRef);
      
      if (quizSnap.exists()) {
        const quizData = quizSnap.data();
        
        // Check TTL logically (24 hours = 86400000 ms)
        if (quizData.createdAt && Date.now() - quizData.createdAt > 86400000) {
          setError('Mã mời đã hết hạn (quá 24 giờ).');
          return;
        }
        
        setQuiz({ id: code, ...quizData });
        setCurrentQuestionIdx(0);
        setScore(0);
        setPointsPossible(700);
      } else {
        setError('Không tìm thấy bài thi. Mã mời không hợp lệ.');
      }
    } catch (err: any) {
      setError('Lỗi khi tham gia: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Timer for decreasing points
  useEffect(() => {
    if (quiz && !isFinished && pointsPossible > 100) {
      const timer = setInterval(() => {
        setPointsPossible(prev => Math.max(100, prev - 10)); // drop 10 points every second, min 100
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [quiz, isFinished, currentQuestionIdx, pointsPossible]);

  const handleAnswer = async (selectedIdx: number) => {
    const question = quiz.questions[currentQuestionIdx];
    const isCorrect = selectedIdx === question.correctAnswer;
    
    const earned = isCorrect ? pointsPossible : 0;
    const newScore = score + earned;
    setScore(newScore);
    
    if (currentQuestionIdx + 1 < quiz.questions.length) {
      setCurrentQuestionIdx(currentQuestionIdx + 1);
      setPointsPossible(700); // reset points for next question
    } else {
      // Finish Quiz
      setIsFinished(true);
      await submitScoreAndGetFeedback(newScore);
    }
  };

  const submitScoreAndGetFeedback = async (finalScore: number) => {
    setLoadingFeedback(true);
    try {
      // 1. Submit score to Firestore
      const studentId = name.replace(/\s+/g, '-').toLowerCase() + '-' + Date.now().toString().slice(-4);
      const scoreRef = doc(db, 'quizzes', quiz.id, 'scores', studentId);
      
      await setDoc(scoreRef, {
        name,
        score: finalScore,
        inviteCode: quiz.id,
        createdAt: Date.now()
      });

      // 2. Fetch AI feedback
      const res = await fetch('/api/student/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name, 
          score: finalScore, 
          totalQuestions: quiz.questions.length 
        })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi nhận xét');
      
      setFeedback(data.feedback);
      
      // 3. Save feedback to Firestore so Admin can see it
      await setDoc(scoreRef, { aiFeedback: data.feedback }, { merge: true });
    } catch (err: any) {
      const errorMsg = 'Lỗi lấy nhận xét AI: ' + err.message;
      setFeedback(errorMsg);
      
      const studentId = name.replace(/\s+/g, '-').toLowerCase() + '-' + Date.now().toString().slice(-4);
      const scoreRef = doc(db, 'quizzes', quiz.id, 'scores', studentId);
      await setDoc(scoreRef, { aiFeedback: errorMsg }, { merge: true });
    } finally {
      setLoadingFeedback(false);
    }
  };

  if (isFinished) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-lg text-center space-y-6 border-t-8 border-blue-500">
          <Trophy className="w-20 h-20 text-yellow-500 mx-auto" />
          <h1 className="text-3xl font-bold text-neutral-800">Hoàn thành xuất sắc!</h1>
          <p className="text-xl text-neutral-600">Chúc mừng <span className="font-semibold text-neutral-900">{name}</span></p>
          
          <div className="bg-blue-50 py-6 rounded-xl border border-blue-100 shadow-inner">
            <p className="text-sm font-bold text-blue-600 mb-1 tracking-widest">ĐIỂM SỐ CỦA BẠN</p>
            <p className="text-6xl font-black text-blue-700 drop-shadow-sm">{score}</p>
          </div>

          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-xl border border-indigo-100 shadow-sm text-left relative overflow-hidden ring-1 ring-indigo-200">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Sparkles className="w-24 h-24" />
            </div>
            <h3 className="font-bold text-indigo-900 mb-4 flex items-center gap-2 text-lg">
              <Sparkles className="w-6 h-6 text-indigo-500" /> Nhận xét từ AI (FreeLLM)
            </h3>
            {loadingFeedback ? (
              <div className="flex items-center gap-3 text-indigo-600 font-medium p-4 bg-white/50 rounded-lg">
                <Loader2 className="w-5 h-5 animate-spin" /> Đang phân tích và viết nhận xét...
              </div>
            ) : (
              <div className="p-4 bg-white/80 rounded-lg border border-indigo-50 backdrop-blur-sm">
                <p className="text-indigo-950 font-medium leading-relaxed text-base">{feedback}</p>
              </div>
            )}
          </div>
          
          <button onClick={() => window.location.reload()} className="mt-4 bg-neutral-100 text-neutral-700 font-bold py-3 px-6 rounded-xl hover:bg-neutral-200 transition-colors">
            Làm bài thi khác
          </button>
        </div>
      </div>
    );
  }

  if (quiz) {
    const question = quiz.questions[currentQuestionIdx];
    return (
      <div className="min-h-screen bg-neutral-100 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          
          <div className="flex justify-between items-end mb-6">
            <div>
              <p className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-1">Chủ đề: {quiz.topic}</p>
              <h2 className="text-2xl font-bold text-neutral-800">Câu {currentQuestionIdx + 1} / {quiz.questions.length}</h2>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-neutral-500">Điểm tối đa</p>
              <p className="text-2xl font-black text-blue-600 transition-colors">{pointsPossible}</p>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl shadow-sm border border-neutral-200">
            <h3 className="text-xl font-medium text-neutral-900 mb-8 leading-relaxed">
              {question.question}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {question.options.map((opt: string, idx: number) => (
                <button
                  key={idx}
                  onClick={() => handleAnswer(idx)}
                  className="text-left p-5 rounded-2xl border-2 border-neutral-100 hover:border-blue-500 hover:bg-blue-50 transition-all font-medium text-neutral-700 hover:text-blue-700"
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
          
          <div className="mt-6 flex justify-between items-center text-sm font-medium text-neutral-500">
            <span>Học sinh: {name}</span>
            <span>Tổng điểm: {score}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <div className="text-center mb-8">
          <div className="bg-blue-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-800">Trắc Nghiệm AI</h1>
          <p className="text-neutral-500 mt-2">Nhập tên và mã mời từ giáo viên để bắt đầu</p>
        </div>
        
        <form onSubmit={handleJoin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Tên của bạn</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-4 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
              placeholder="VD: Nguyễn Văn A"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Mã Mời (Invite Code)</label>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="w-full p-4 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none font-mono uppercase tracking-widest"
              placeholder="XXXXXX"
              maxLength={6}
              required
            />
          </div>
          
          {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 text-white font-bold p-4 rounded-xl hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <>Vào thi ngay <ArrowRight className="w-5 h-5" /></>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
