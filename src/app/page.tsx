"use client";

import { useState, useEffect, useRef } from "react";

// 4x4 그리드: 총 16장 (8종류의 과일 쌍)
interface FruitItem {
  id: string;
  name: string;
  icon: string;
}

// 모노톤 테마에 최적화된 아이콘 및 명칭
const FRUITS_DATA: FruitItem[] = [
  { id: "apple", name: "사과", icon: "🍎" },
  { id: "banana", name: "바나나", icon: "🍌" },
  { id: "grape", name: "포도", icon: "🍇" },
  { id: "orange", name: "오렌지", icon: "🍊" },
  { id: "strawberry", name: "딸기", icon: "🍓" },
  { id: "watermelon", name: "수박", icon: "🍉" },
  { id: "cherry", name: "체리", icon: "🍒" },
  { id: "pineapple", name: "파인애플", icon: "🍍" },
];

interface Card {
  instanceId: number;
  fruit: FruitItem;
  isFlipped: boolean;
  isMatched: boolean;
}

type GameStage = "LOGIN" | "READY" | "PLAYING" | "PAUSED" | "FINISHED";

export default function MemoryCardGame() {
  const [userName, setUserName] = useState<string>("");
  const [tempName, setTempName] = useState<string>("");
  const [stage, setStage] = useState<GameStage>("LOGIN");

  // 라이트 / 다크 모드 상태 (기본값: 시스템 설정 감지 또는 라이트)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  // 게임 상태
  const [cards, setCards] = useState<Card[]>([]);
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [matchedPairsCount, setMatchedPairsCount] = useState<number>(0);
  const [movesCount, setMovesCount] = useState<number>(0);

  // 구글 스프레드시트 웹 앱 URL (배포 후 아래 URL에 복사한 주소를 넣어주세요)
  const GOOGLE_SCRIPT_URL =
    process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL || "";

  // 시간 측정 (밀리초)
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 시트 전송 상태
  const [isSavingRecord, setIsSavingRecord] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");

  // 상위 5명 순위 데이터
  interface RankingItem {
    rank: number;
    name: string;
    score: number;
    finishtime: string;
  }
  const [rankings, setRankings] = useState<RankingItem[]>([]);
  const [isLoadingRankings, setIsLoadingRankings] = useState<boolean>(false);

  // 다크모드 로컬스토리지 & 시스템 기본값 초기화
  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem("theme");
    const isDark =
      savedTheme === "dark" ||
      (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches);
    
    setIsDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem("theme", next ? "dark" : "light");
      if (next) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      return next;
    });
  };

  // 타이머 작동 제어
  useEffect(() => {
    if (stage === "PLAYING") {
      timerRef.current = setInterval(() => {
        setElapsedTime((prev) => prev + 100);
      }, 100);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [stage]);

  // 카드 덱 생성 및 셔플 (Fisher-Yates)
  const generateDeck = (): Card[] => {
    const deckFruits = [...FRUITS_DATA, ...FRUITS_DATA];
    for (let i = deckFruits.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deckFruits[i], deckFruits[j]] = [deckFruits[j], deckFruits[i]];
    }

    return deckFruits.map((fruit, index) => ({
      instanceId: index,
      fruit,
      isFlipped: false,
      isMatched: false,
    }));
  };

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempName.trim()) return;
    setUserName(tempName.trim());
    setStage("READY");
    resetGameSession();
  };

  const resetGameSession = () => {
    const newDeck = generateDeck();
    setCards(newDeck);
    setSelectedCards([]);
    setIsProcessing(false);
    setMatchedPairsCount(0);
    setMovesCount(0);
    setElapsedTime(0);
  };

  const handleStartGame = () => {
    resetGameSession();
    setStage("PLAYING");
  };

  const handlePauseResume = () => {
    if (stage === "PLAYING") {
      setStage("PAUSED");
    } else if (stage === "PAUSED") {
      setStage("PLAYING");
    }
  };

  const handleRestart = () => {
    resetGameSession();
    setStage("PLAYING");
  };

  const handleGoToLogin = () => {
    setStage("LOGIN");
    setUserName("");
    setTempName("");
    setElapsedTime(0);
  };

  // 상위 5명 순위 가져오기
  const fetchRankings = async () => {
    if (!GOOGLE_SCRIPT_URL) return;
    try {
      setIsLoadingRankings(true);
      const res = await fetch(GOOGLE_SCRIPT_URL, {
        method: "GET",
      });
      const data = await res.json();
      if (data && data.rankings) {
        setRankings(data.rankings);
      }
    } catch (err) {
      console.warn("순위 불러오기 실패:", err);
    } finally {
      setIsLoadingRankings(false);
    }
  };

  // 구글 시트로 기록 전송 (성공 시에만 호출됨, 중단/취소 시 호출되지 않음)
  const saveScoreToGoogleSheet = async (finalTimeFormatted: string, finalMoves: number) => {
    if (!GOOGLE_SCRIPT_URL) return;

    try {
      setIsSavingRecord(true);
      setSaveStatus("idle");

      const now = new Date();
      const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
        now.getDate()
      ).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(
        now.getMinutes()
      ).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

      const payload = {
        timestamp,
        name: userName,
        score: finalMoves, // 시도 횟수
        finishtime: finalTimeFormatted,
      };

      await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      setSaveStatus("success");
      // 기록 저장 완료 후 최신 상위 5명 순위 조회
      setTimeout(() => {
        fetchRankings();
      }, 700);
    } catch (err) {
      console.error("구글 시트 저장 실패:", err);
      setSaveStatus("error");
    } finally {
      setIsSavingRecord(false);
    }
  };

  const handleCardClick = (index: number) => {
    if (stage !== "PLAYING") return;
    if (isProcessing) return;

    const clickedCard = cards[index];
    if (clickedCard.isFlipped || clickedCard.isMatched) return;

    const newCards = [...cards];
    newCards[index].isFlipped = true;
    setCards(newCards);

    const newSelected = [...selectedCards, index];
    setSelectedCards(newSelected);

    if (newSelected.length === 2) {
      setIsProcessing(true);
      const updatedMoves = movesCount + 1;
      setMovesCount(updatedMoves);

      const [firstIdx, secondIdx] = newSelected;
      const firstCard = cards[firstIdx];
      const secondCard = cards[secondIdx];

      if (firstCard.fruit.id === secondCard.fruit.id) {
        setTimeout(() => {
          setCards((prev) =>
            prev.map((card, idx) =>
              idx === firstIdx || idx === secondIdx
                ? { ...card, isMatched: true }
                : card
            )
          );
          setSelectedCards([]);
          setIsProcessing(false);

          setMatchedPairsCount((prev) => {
            const nextCount = prev + 1;
            if (nextCount === FRUITS_DATA.length) {
              setStage("FINISHED");
              // 게임 완료 시에만 구글 시트 저장 실행
              const finalFormatted = formatTime(elapsedTime);
              saveScoreToGoogleSheet(finalFormatted, updatedMoves);
            }
            return nextCount;
          });
        }, 450);
      } else {
        setTimeout(() => {
          setCards((prev) =>
            prev.map((card, idx) =>
              idx === firstIdx || idx === secondIdx
                ? { ...card, isFlipped: false }
                : card
            )
          );
          setSelectedCards([]);
          setIsProcessing(false);
        }, 850);
      }
    }
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const tenths = Math.floor((ms % 1000) / 100);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
  };

  if (!mounted) {
    return null; // SSR 하이드레이션 불일치 방지
  }

  return (
    <div className={isDarkMode ? "dark" : ""}>
      <div className="min-h-screen bg-neutral-100 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col justify-between transition-colors duration-300 font-sans">
        
        {/* 상단 네비게이션: 테마 토글 버튼 */}
        <header className="w-full max-w-4xl mx-auto px-4 sm:px-6 pt-5 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-neutral-800 dark:bg-neutral-200" />
            <span className="text-xs tracking-wider uppercase font-semibold text-neutral-500 dark:text-neutral-400">
              Memory Match
            </span>
          </div>

          <button
            onClick={toggleTheme}
            aria-label="라이트/다크모드 전환"
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all cursor-pointer shadow-sm active:scale-95"
          >
            {isDarkMode ? (
              <>
                <span className="grayscale">☀️</span>
                <span>라이트 모드</span>
              </>
            ) : (
              <>
                <span className="grayscale">🌙</span>
                <span>다크 모드</span>
              </>
            )}
          </button>
        </header>

        {/* 메인 컨텐츠 영역 */}
        <main className="w-full flex-1 flex flex-col items-center justify-center px-4 py-6">
          
          {/* 1. 사용자 이름 입력 화면 */}
          {stage === "LOGIN" && (
            <div className="w-full max-w-sm sm:max-w-md bg-white dark:bg-neutral-900 rounded-2xl p-6 sm:p-8 shadow-xl border border-neutral-200 dark:border-neutral-800 text-center transition-all duration-300">
              <div className="w-14 h-14 mx-auto mb-4 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/80 flex items-center justify-center text-2xl font-black text-neutral-800 dark:text-neutral-200 select-none">
                ✦
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-100 mb-2">
                카드 맞추기 게임
              </h1>
              <p className="text-neutral-500 dark:text-neutral-400 mb-8 text-xs sm:text-sm">
                4×4 카드의 짝을 맞춰 가장 빠른 기록에 도전하세요.
              </p>

              <form onSubmit={handleNameSubmit} className="space-y-4">
                <div>
                  <input
                    type="text"
                    placeholder="도전자 이름을 입력하세요"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    maxLength={12}
                    autoFocus
                    className="w-full px-4 py-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/60 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500 focus:border-transparent transition-all text-center text-base sm:text-lg font-medium"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!tempName.trim()}
                  className="w-full py-3.5 px-6 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-neutral-200 text-white dark:text-neutral-900 font-bold text-sm sm:text-base tracking-wide transition-all shadow-md active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  입장하기
                </button>
              </form>
            </div>
          )}

          {/* 2. 게임 보드 및 조작 화면 */}
          {stage !== "LOGIN" && (
            <div className="w-full max-w-md sm:max-w-lg flex flex-col items-center">
              
              {/* 상단 제목 및 플레이어 정보 헤더 */}
              <div className="w-full mb-3 text-center">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-neutral-900 dark:text-neutral-100">
                  카드 맞추기 게임
                </h1>
              </div>

              {/* 통계 / 상태창 */}
              <div className="w-full flex items-center justify-between mb-3 bg-white dark:bg-neutral-900 rounded-xl px-4 py-3 border border-neutral-200 dark:border-neutral-800 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    {userName.slice(0, 1)}
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-semibold text-neutral-400">Player</span>
                    <span className="text-xs sm:text-sm font-bold text-neutral-800 dark:text-neutral-200">{userName}</span>
                  </div>
                </div>

                <div className="flex items-center gap-5 sm:gap-6">
                  <div className="text-right">
                    <span className="block text-[10px] uppercase font-semibold text-neutral-400">Time</span>
                    <span className="text-lg sm:text-xl font-mono font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                      {formatTime(elapsedTime)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="block text-[10px] uppercase font-semibold text-neutral-400">Pairs</span>
                    <span className="text-lg sm:text-xl font-mono font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                      {matchedPairsCount}<span className="text-xs font-normal text-neutral-400">/8</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* 조작 버튼 컨트롤 */}
              <div className="w-full flex items-center justify-between gap-2 mb-3">
                {stage === "READY" && (
                  <button
                    onClick={handleStartGame}
                    className="flex-1 py-2.5 px-3 rounded-lg bg-neutral-900 dark:bg-neutral-100 hover:bg-neutral-800 dark:hover:bg-neutral-200 text-white dark:text-neutral-900 text-xs sm:text-sm font-bold shadow-sm transition-all active:scale-95 cursor-pointer"
                  >
                    ▶ 게임 시작
                  </button>
                )}

                {(stage === "PLAYING" || stage === "PAUSED") && (
                  <button
                    onClick={handlePauseResume}
                    className="flex-1 py-2.5 px-3 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-xs sm:text-sm font-semibold transition-all active:scale-95 cursor-pointer"
                  >
                    {stage === "PAUSED" ? "▶ 계속하기" : "⏸ 멈춤"}
                  </button>
                )}

                {stage !== "READY" && (
                  <button
                    onClick={handleRestart}
                    className="py-2.5 px-3.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs sm:text-sm font-semibold transition-all active:scale-95 cursor-pointer"
                  >
                    다시 시작
                  </button>
                )}

                <button
                  onClick={handleGoToLogin}
                  className="py-2.5 px-3.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400 text-xs sm:text-sm font-semibold transition-all active:scale-95 cursor-pointer"
                >
                  처음으로
                </button>
              </div>

              {/* 4x4 카드 보드 영역 (반응형 최적화) */}
              <div className="relative w-full aspect-square max-w-[390px] sm:max-w-[440px] bg-white dark:bg-neutral-900 rounded-2xl p-3 sm:p-4 border border-neutral-200 dark:border-neutral-800 shadow-md flex items-center justify-center">
                
                {/* 일시 정지 오버레이 */}
                {stage === "PAUSED" && (
                  <div className="absolute inset-0 bg-neutral-900/60 backdrop-blur-xs rounded-2xl z-20 flex flex-col items-center justify-center text-white">
                    <span className="text-3xl font-mono mb-2">PAUSED</span>
                    <p className="text-xs text-neutral-300 mb-4">게임이 일시 정지되었습니다.</p>
                    <button
                      onClick={handlePauseResume}
                      className="px-5 py-2 rounded-lg bg-neutral-100 hover:bg-white text-neutral-900 text-xs font-bold transition-all active:scale-95 cursor-pointer"
                    >
                      계속 진행하기
                    </button>
                  </div>
                )}

                {/* 게임 준비 오버레이 */}
                {stage === "READY" && (
                  <div className="absolute inset-0 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-xs rounded-2xl z-20 flex flex-col items-center justify-center text-center p-6">
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-1">
                      준비되셨나요, {userName}님?
                    </h2>
                    <p className="text-neutral-500 dark:text-neutral-400 text-xs mb-5">
                      카드를 눌러 같은 짝을 모두 찾아보세요.
                    </p>
                    <button
                      onClick={handleStartGame}
                      className="px-6 py-2.5 bg-neutral-900 dark:bg-neutral-100 hover:bg-neutral-800 dark:hover:bg-neutral-200 text-white dark:text-neutral-900 rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all active:scale-95 cursor-pointer"
                    >
                      게임 시작하기
                    </button>
                  </div>
                )}

                {/* 4x4 카드 그리드 */}
                <div className="grid grid-cols-4 grid-rows-4 gap-2 sm:gap-2.5 w-full h-full">
                  {cards.map((card, index) => {
                    const isOpen = card.isFlipped || card.isMatched;

                    return (
                      <button
                        key={card.instanceId}
                        disabled={stage !== "PLAYING" || card.isMatched || isProcessing}
                        onClick={() => handleCardClick(index)}
                        aria-label={`카드 ${index + 1}`}
                        className={`relative w-full h-full rounded-xl transition-all duration-200 select-none cursor-pointer ${
                          card.isMatched
                            ? "opacity-60 scale-[0.98]"
                            : "hover:scale-[1.02] active:scale-95"
                        }`}
                      >
                        <div
                          className={`w-full h-full rounded-xl flex items-center justify-center border transition-all duration-300 ${
                            isOpen
                              ? "bg-neutral-50 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600 shadow-inner"
                              : "bg-neutral-800 dark:bg-neutral-200 border-neutral-900 dark:border-neutral-100 shadow-sm"
                          } ${
                            card.isMatched
                              ? "ring-2 ring-neutral-400 dark:ring-neutral-500 ring-offset-1 dark:ring-offset-neutral-900"
                              : ""
                          }`}
                        >
                          {isOpen ? (
                            <div className="flex flex-col items-center justify-center">
                              {/* 과일 아이콘 컬러 표시 */}
                              <span className="text-2xl sm:text-3xl select-none transition-transform">
                                {card.fruit.icon}
                              </span>
                              <span className="text-[9px] sm:text-[10px] font-semibold text-neutral-600 dark:text-neutral-300 mt-0.5">
                                {card.fruit.name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-neutral-400 dark:text-neutral-500 font-bold text-sm sm:text-base select-none">
                              ?
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 완료 시 모달 팝업 */}
              {stage === "FINISHED" && (
                <div className="fixed inset-0 bg-neutral-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 sm:p-7 max-w-xs sm:max-w-sm w-full text-center shadow-2xl border border-neutral-200 dark:border-neutral-800">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-xl font-black text-neutral-800 dark:text-neutral-200">
                      ✓
                    </div>
                    <h2 className="text-2xl font-black text-neutral-900 dark:text-neutral-100 mb-1">
                      게임 완료!
                    </h2>
                    <p className="text-neutral-500 dark:text-neutral-400 text-xs mb-5">
                      <span className="font-semibold text-neutral-800 dark:text-neutral-200">{userName}</span>님이 모든 카드를 맞췄습니다.
                    </p>

                    <div className="bg-neutral-50 dark:bg-neutral-800/60 rounded-xl p-3.5 mb-4 border border-neutral-200 dark:border-neutral-700/60 flex justify-around items-center">
                      <div>
                        <span className="block text-[10px] uppercase font-semibold text-neutral-400">기록 시간</span>
                        <span className="text-xl font-mono font-black text-neutral-900 dark:text-neutral-100">
                          {formatTime(elapsedTime)}
                        </span>
                      </div>
                      <div className="w-[1px] h-7 bg-neutral-200 dark:bg-neutral-700" />
                      <div>
                        <span className="block text-[10px] uppercase font-semibold text-neutral-400">뒤집은 횟수</span>
                        <span className="text-xl font-mono font-black text-neutral-900 dark:text-neutral-100">
                          {movesCount}회
                        </span>
                      </div>
                    </div>

                    {/* 구글 스프레드시트 저장 상태 안내 */}
                    {GOOGLE_SCRIPT_URL && (
                      <div className="mb-3 text-xs">
                        {isSavingRecord && (
                          <span className="text-neutral-500 animate-pulse flex items-center justify-center gap-1.5">
                            <span className="inline-block w-2 h-2 rounded-full bg-neutral-400 animate-ping" />
                            스프레드시트에 기록 저장 중...
                          </span>
                        )}
                        {saveStatus === "success" && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            ✓ 구글 스프레드시트에 기록 완료!
                          </span>
                        )}
                        {saveStatus === "error" && (
                          <span className="text-red-500 font-medium">
                            ✕ 스프레드시트 저장 중 문제가 발생했습니다.
                          </span>
                        )}
                      </div>
                    )}

                    {/* 상위 5명 순위표 (TOP 5 LEADERBOARD) */}
                    <div className="w-full mb-4 bg-neutral-50 dark:bg-neutral-800/40 rounded-xl p-3 border border-neutral-200 dark:border-neutral-800 text-left">
                      <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-neutral-200 dark:border-neutral-700/60">
                        <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1">
                          <span>🏆</span> TOP 5 순위표 (소요 시간순)
                        </span>
                        {isLoadingRankings && (
                          <span className="text-[10px] text-neutral-400 animate-pulse">갱신 중...</span>
                        )}
                      </div>

                      {rankings.length > 0 ? (
                        <div className="flex flex-col gap-1.5">
                          {rankings.map((item) => {
                            const isMe = item.name === userName;
                            return (
                              <div
                                key={item.rank}
                                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                                  isMe
                                    ? "bg-neutral-200 dark:bg-neutral-700/80 font-bold text-neutral-900 dark:text-neutral-50 ring-1 ring-neutral-400 dark:ring-neutral-500"
                                    : "bg-white/60 dark:bg-neutral-800/60 text-neutral-700 dark:text-neutral-300"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${
                                      item.rank === 1
                                        ? "bg-amber-400 text-black font-extrabold"
                                        : item.rank === 2
                                        ? "bg-neutral-300 dark:bg-neutral-600 text-neutral-800 dark:text-neutral-200"
                                        : item.rank === 3
                                        ? "bg-amber-700/30 text-amber-900 dark:text-amber-300"
                                        : "text-neutral-400"
                                    }`}
                                  >
                                    {item.rank}
                                  </span>
                                  <span className="truncate max-w-[90px] sm:max-w-[120px]">
                                    {item.name} {isMe && "(나)"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 font-mono">
                                  <span className="font-semibold">{item.finishtime}</span>
                                  <span className="text-[10px] text-neutral-400">{item.score}회</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[11px] text-neutral-400 text-center py-2">
                          {isLoadingRankings ? "순위를 불러오는 중입니다..." : "등록된 순위 데이터가 없습니다."}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <button
                        onClick={handleRestart}
                        className="w-full py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-neutral-200 text-white dark:text-neutral-900 text-xs sm:text-sm font-bold shadow-sm transition-all active:scale-95 cursor-pointer"
                      >
                        다시 시작하기
                      </button>
                      <button
                        onClick={handleGoToLogin}
                        className="w-full py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
                      >
                        처음으로 (사용자 변경)
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        {/* 하단 푸터 카피라이트 */}
        <footer className="w-full py-5 text-center text-xs text-neutral-400 dark:text-neutral-500 font-mono tracking-tight">
          Copyright INU 카드 맞추기 게임 by Haesol
        </footer>
      </div>
    </div>
  );
}
