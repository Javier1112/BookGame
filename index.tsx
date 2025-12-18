
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";

// --- Constants & Types ---

const PRESET_BOOKS = [
  { title: "明朝那些事儿", id: "1186557", link: "https://findshnu.libsp.cn/#/searchList/bookDetails/1186557" },
  { title: "红楼梦", id: "1037001", link: "https://findshnu.libsp.cn/#/searchList/bookDetails/1037001" },
  { title: "百年孤独", id: "868521", link: "https://findshnu.libsp.cn/#/searchList/bookDetails/868521" },
  { title: "杀死一只知更鸟", id: "1058238", link: "https://findshnu.libsp.cn/#/searchList/bookDetails/1058238" },
  { title: "第七天", id: "947870", link: "https://findshnu.libsp.cn/#/searchList/bookDetails/947870" }
];

const LOADING_MESSAGES = [
  "正在翻开思齐轩古老的书页...",
  "正在重构贤馨苑的像素世界...",
  "正在捕捉闻道轩中有趣的灵魂...",
  "正在绘制海思路奇幻的场景...",
  "正在注入文学魔力...",
  "正在点燃纸墨与星盐的烛火",
  "正在召回被遗忘的注脚",
  "正在链接上师大图书馆...",
  "贤藏阁的书籍之门即将开启..."
];

interface GameState {
  round: number;
  bookTitle: string;
  characterName: string;
  sceneDescription: string;
  imagePrompt: string;
  imageUrl: string;
  options: { label: string; text: string }[];
  history: string[];
  isGameOver: boolean;
  isVictory: boolean;
  libraryLink: string;
}

// --- Components ---

const RetroContainer = ({ children }: { children?: React.ReactNode }) => (
  <div style={{
    maxWidth: '800px',
    margin: '20px auto',
    padding: '20px',
    border: '4px solid #fff',
    borderRadius: '12px',
    backgroundColor: '#385848', 
    boxShadow: '0 0 0 4px #000, 10px 10px 0 rgba(0,0,0,0.5)',
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 80px)',
    position: 'relative',
    overflowY: 'auto'
  }}>
    {children}
  </div>
);

const App = () => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [inputBook, setInputBook] = useState('');
  const [error, setError] = useState<string | null>(null);

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Handle rotating loading messages
  useEffect(() => {
    let interval: number;
    if (loading) {
      interval = window.setInterval(() => {
        setLoadingMsgIdx(prev => (prev + 1) % LOADING_MESSAGES.length);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [loading]);

  // Handle granular progress bar state
  useEffect(() => {
    let timer: number;
    if (loading) {
      setProgress(0);
      timer = window.setInterval(() => {
        setProgress(prev => {
          if (prev >= 99) return prev;
          let increment = 0;
          if (prev < 20) increment = Math.random() * 5;
          else if (prev < 50) increment = Math.random() * 2;
          else if (prev < 80) increment = Math.random() * 1;
          else increment = Math.random() * 0.3;
          
          const next = prev + increment;
          return next > 99 ? 99 : next;
        });
      }, 200);
    } else {
      setProgress(0);
    }
    return () => clearInterval(timer);
  }, [loading]);

  const getGeminiStory = async (bookTitle: string, userChoice: string | null, currentRound: number, history: string[]) => {
    const isFirstTurn = currentRound === 0;
    const isFinalTurn = currentRound === 4;

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: isFirstTurn 
        ? `Start a role-playing game based on the book "${bookTitle}". We are at Round 1 of 5. Establish the protagonist and the opening scene.`
        : `We are at Round ${currentRound + 1} of 5 in a game based on "${bookTitle}". The user chose: "${userChoice}". Continue the story. History: ${history.join(" -> ")}. ${isFinalTurn ? "This is the final turn, end with a suspenseful cliffhanger." : ""}`,
      config: {
        systemInstruction: `You are the "SHNU Playbrary" Game Master. 
        1. Game lasts exactly 5 rounds. 
        2. Mimic the original author's literary style perfectly. 
        3. For Chinese classics, use an appropriate classical or semi-classical tone.
        4. Round 5 must end on a massive cliffhanger.
        5. Visual Rule: The "image_prompt" you provide MUST describe only characters, environment, and action. 
           CRITICAL: STRICTLY FORBID any mention of text, letters, speech bubbles, writing, captions, or symbols in the prompt. 
           Instead, use character expressions, body language, and environmental storytelling to convey meaning.
        6. Always output in valid JSON format.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            character_name: { type: Type.STRING, description: "Name of the protagonist in Chinese" },
            scene_description: { type: Type.STRING, description: "Description of the current scene in Chinese" },
            options: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING, description: "A, B, or C" },
                  text: { type: Type.STRING, description: "Short description of the choice in Chinese" }
                },
                required: ["label", "text"]
              }
            },
            image_prompt: { type: Type.STRING, description: "English prompt for image generation. Focus strictly on visuals. ABSOLUTELY NO TEXT OR LETTERS." },
            is_game_over: { type: Type.BOOLEAN, description: "True if the game reaches round 5 or player fails" }
          },
          required: ["character_name", "scene_description", "options", "image_prompt", "is_game_over"]
        }
      }
    });

    return JSON.parse(response.text);
  };

  const getGeminiImage = async (prompt: string) => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{
        parts: [{ text: `A vibrant 8-bit pixel art scene, high quality, SNES RPG aesthetic, colorful retro game style: ${prompt}. THE IMAGE MUST NOT CONTAIN ANY TEXT, LETTERS, SPEECH BUBBLES, OR SYMBOLS. FOCUS ON CHARACTER EXPRESSIONS AND POSES.` }]
      }],
      config: {
        imageConfig: {
          aspectRatio: "16:9"
        }
      }
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return "https://via.placeholder.com/512x512/385848/FFFFFF?text=Generating+Art...";
  };

  const generateGameTurn = async (bookTitle: string, userChoice: string | null = null, currentRound: number = 0, history: string[] = []) => {
    setLoading(true);
    setError(null);
    try {
      const storyData = await getGeminiStory(bookTitle, userChoice, currentRound, history);
      const imageUrl = await getGeminiImage(storyData.image_prompt);

      const preset = PRESET_BOOKS.find(b => b.title === bookTitle);
      const libraryLink = preset ? preset.link : `https://findshnu.libsp.cn/#/searchList?searchKeyword=${encodeURIComponent(bookTitle)}`;

      setGameState({
        round: currentRound + 1,
        bookTitle: bookTitle,
        characterName: storyData.character_name,
        sceneDescription: storyData.scene_description,
        imagePrompt: storyData.image_prompt,
        imageUrl: imageUrl,
        options: storyData.options,
        history: [...history, userChoice || ""],
        isGameOver: storyData.is_game_over,
        isVictory: currentRound === 4,
        libraryLink: libraryLink
      });

    } catch (err: any) {
      console.error(err);
      setError("Gemini 引擎由于内容过滤或连接问题暂时无法翻开书页，请重试或尝试其他书籍。");
    } finally {
      setLoading(false);
    }
  };

  const handleStart = (title: string) => {
    if (!title || loading) return;
    generateGameTurn(title);
  };

  const handleChoice = (choiceText: string) => {
    if (!gameState || loading) return;
    generateGameTurn(gameState.bookTitle, choiceText, gameState.round, gameState.history);
  };

  if (!gameState) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#000' }}>
        <RetroContainer>
          <div style={{ textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '10px' }}>
            <h1 style={{ 
              fontSize: '48px', 
              marginBottom: '40px', 
              marginTop: '-20px',
              letterSpacing: '3px',
              display: 'flex',
              justifyContent: 'center',
              flexWrap: 'wrap',
              filter: 'drop-shadow(4px 4px 0px #2a75bb)'
            }}>
              {"SHNU PLAYBRARY".split("").map((char, i) => (
                <span 
                  key={i} 
                  className="sway-char" 
                  style={{ 
                    animationDelay: `${i * 0.1}s`,
                    display: char === ' ' ? 'inline' : 'inline-block'
                  }}
                >
                  {char === ' ' ? '\u00A0' : char}
                </span>
              ))}
            </h1>
            <p className="zh-text" style={{ fontSize: '22px', marginBottom: '30px', color: '#fff' }}>请选择任意一本书籍，开启您的冒险之旅！</p>
            
            <div style={{ display: 'grid', gap: '15px', marginBottom: '25px' }}>
              {PRESET_BOOKS.map((book, idx) => (
                <button 
                  key={book.id}
                  onClick={() => handleStart(book.title)}
                  className={`zh-text option-dynamic`}
                  style={{
                    padding: '16px',
                    backgroundColor: '#fff',
                    color: '#000',
                    border: '4px solid #000',
                    cursor: 'pointer',
                    fontSize: '20px',
                    boxShadow: '6px 6px 0 rgba(0,0,0,0.5)',
                    animationDelay: `${idx * 0.4}s`
                  }}
                  disabled={loading}
                >
                  《{book.title}》
                </button>
              ))}
            </div>

            <div style={{ padding: '0 10px', marginBottom: '10px' }}>
              <input 
                type="text"
                placeholder="或者输入其他书名+作者"
                value={inputBook}
                onChange={(e) => setInputBook(e.target.value)}
                className="zh-text"
                style={{
                  width: '100%',
                  padding: '16px',
                  fontSize: '20px',
                  border: '4px solid #000',
                  marginBottom: '15px',
                  backgroundColor: '#fff', 
                  color: '#000',
                  boxSizing: 'border-box',
                  textAlign: 'center'
                }}
              />
              <button 
                onClick={() => handleStart(inputBook)}
                className="zh-text heartbeat"
                style={{
                  width: '100%',
                  padding: '18px',
                  backgroundColor: '#ee1515',
                  color: '#fff',
                  border: '4px solid #000',
                  cursor: 'pointer',
                  fontSize: '22px',
                  fontWeight: 'bold',
                  boxShadow: '6px 6px 0 rgba(0,0,0,0.5)'
                }}
                disabled={loading || !inputBook.trim()}
              >
                开始探险 (START)
              </button>
            </div>

            {loading && (
              <div style={{ marginTop: '25px', width: '85%', margin: '20px auto 0' }}>
                <p className="zh-text heartbeat" style={{ color: '#ffcb05', fontSize: '18px', marginBottom: '15px', fontWeight: 'bold' }}>
                  {LOADING_MESSAGES[loadingMsgIdx]}
                </p>
                
                <div style={{ 
                  height: '36px', 
                  border: '4px solid #000', 
                  backgroundColor: '#fff', 
                  padding: '4px',
                  boxShadow: '4px 4px 0 rgba(0,0,0,0.5)',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <div className="loading-stripes-bg" style={{ 
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    height: '100%', 
                    backgroundColor: '#ee1515',
                    width: `${progress}%`,
                    backgroundImage: 'linear-gradient(45deg, rgba(255, 255, 255, 0.25) 25%, transparent 25%, transparent 50%, rgba(255, 255, 255, 0.25) 50%, rgba(255, 255, 255, 0.25) 75%, transparent 75%, transparent)',
                    backgroundSize: '40px 40px',
                    boxShadow: 'inset 0 0 10px rgba(0,0,0,0.3)',
                    transition: 'width 0.3s ease-out'
                  }}></div>
                  
                  <div className="zh-text" style={{ 
                    position: 'absolute', 
                    width: '100%', 
                    textAlign: 'center', 
                    zIndex: 2,
                    color: progress > 50 ? '#fff' : '#000',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    textShadow: progress > 50 ? '2px 2px 0 #000' : 'none',
                    left: 0
                  }}>
                    {Math.floor(progress)}%
                  </div>
                </div>

                <p className="zh-text" style={{ color: '#aaa', fontSize: '14px', marginTop: '12px' }}>
                  正在连接 SHNU 图书馆元宇宙...
                </p>
              </div>
            )}
            
            {error && (
              <div style={{ 
                marginTop: '15px', 
                backgroundColor: 'rgba(255,0,0,0.15)', 
                border: '2px solid #ff0000', 
                padding: '10px',
                borderRadius: '4px'
              }}>
                <p className="zh-text" style={{ color: '#ffaaaa', fontSize: '14px', margin: 0 }}>{error}</p>
              </div>
            )}
          </div>
        </RetroContainer>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#000' }}>
      <RetroContainer>
        {/* Header */}
        <div style={{ 
          position: 'relative', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '15px',
          height: '60px'
        }}>
          <div className="zh-text" style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffcb05', zIndex: 1 }}>
            《{gameState.bookTitle}》
          </div>
          <div className="zh-text" style={{ 
            position: 'absolute', 
            left: '50%', 
            transform: 'translateX(-50%)', 
            fontSize: '24px', 
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
            color: '#fff'
          }}>
            进度 {gameState.round}/5
          </div>
          <button 
            onClick={() => setGameState(null)}
            className="zh-text"
            style={{ 
              zIndex: 1, 
              padding: '8px 20px', 
              fontSize: '20px', 
              fontWeight: 'bold', 
              backgroundColor: '#ee1515', 
              color: '#fff', 
              border: '2px solid #000', 
              cursor: 'pointer',
              lineHeight: '1.2'
            }}
          >
            退出
          </button>
        </div>

        {/* Scene Image */}
        <div style={{ 
          flex: 1, 
          backgroundColor: '#000', 
          border: '4px solid #fff', 
          marginBottom: '15px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '220px',
          overflow: 'hidden',
          borderRadius: '4px'
        }}>
          {loading ? (
            <div className="spinner"></div>
          ) : (
            <img 
              src={gameState.imageUrl} 
              alt="Scene" 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            />
          )}
        </div>

        {/* Character Role (Centered) */}
        <div className="zh-text" style={{ 
          backgroundColor: '#fff', 
          color: '#000', 
          padding: '6px 30px', 
          fontSize: '18px', 
          border: '2px solid #000',
          marginBottom: '12px',
          alignSelf: 'center',
          fontWeight: 'bold',
          boxShadow: '3px 3px 0 rgba(0,0,0,0.5)',
          whiteSpace: 'nowrap'
        }}>
          您现在的身份是: {gameState.characterName}
        </div>

        {/* Interaction Box */}
        <div style={{
          backgroundColor: '#fff',
          color: '#000',
          border: '4px solid #000',
          borderRadius: '4px',
          padding: '15px',
          minHeight: '180px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '4px 4px 0 rgba(0,0,0,0.2)'
        }}>
          <div className="zh-text" style={{ fontSize: '16px', lineHeight: '1.6', flex: 1, overflowY: 'auto', marginBottom: '15px' }}>
            {gameState.round === 5 ? (
              <div style={{ textAlign: 'center', padding: '10px' }}>
                <p className="zh-text" style={{ marginBottom: '25px' }}>{gameState.sceneDescription}</p>
                
                {/* Immersive Scroll for Ending Message */}
                <div style={{ 
                  margin: '25px 0', 
                  padding: '20px', 
                  border: '4px double #ee1515', 
                  backgroundColor: '#fffaf0',
                  boxShadow: '4px 4px 0 rgba(0,0,0,0.1)',
                  position: 'relative'
                }}>
                  <p className="zh-text glow-text" style={{ 
                    fontSize: '22px', 
                    color: '#ee1515', 
                    fontWeight: 'bold', 
                    margin: '0 0 10px 0',
                  }}>
                    📖 结局悬而未决...
                  </p>
                  <p className="zh-text" style={{ fontSize: '16px', margin: 0, color: '#444' }}>
                    真相就在上海师范大学图书馆的原著中。
                  </p>
                </div>

                {/* Floating Action Buttons */}
                <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginTop: '15px' }}>
                  <a 
                    href={gameState.libraryLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="zh-text float-btn"
                    style={{
                      display: 'inline-block',
                      padding: '14px 24px',
                      backgroundColor: '#385848',
                      color: '#fff',
                      textDecoration: 'none',
                      border: '3px solid #000',
                      borderRadius: '4px',
                      fontSize: '16px',
                      boxShadow: '4px 4px 0 rgba(0,0,0,0.3)'
                    }}
                  >
                    前往图书馆借阅
                  </a>
                  <button 
                    onClick={() => setGameState(null)}
                    className="zh-text float-btn-alt"
                    style={{ 
                      padding: '14px 24px', 
                      backgroundColor: '#fff', 
                      color: '#000', 
                      border: '3px solid #000', 
                      fontSize: '16px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      boxShadow: '4px 4px 0 rgba(0,0,0,0.3)'
                    }}
                  >
                    再玩一局
                  </button>
                </div>
              </div>
            ) : (
              gameState.sceneDescription
            )}
          </div>

          {!gameState.isGameOver && gameState.round < 5 && !loading && (
            <div style={{ display: 'grid', gap: '8px' }}>
              {(gameState.options || []).map((opt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleChoice(opt.text)}
                  className="zh-text option-dynamic"
                  style={{
                    textAlign: 'center',
                    padding: '10px 15px',
                    border: '2px solid #000',
                    backgroundColor: '#f5f5f5',
                    color: '#000',
                    fontSize: '15px',
                    cursor: 'pointer',
                    boxShadow: '2px 2px 0 rgba(0,0,0,0.2)',
                    animationDelay: `${idx * 0.8}s`
                  }}
                >
                  <span style={{ fontWeight: 'bold', marginRight: '5px', color: '#ee1515' }}>{opt.label}.</span>
                  <span>{opt.text}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </RetroContainer>
      <style>{`
        .spinner {
          width: 30px;
          height: 30px;
          border: 4px solid rgba(255,255,255,0.2);
          border-top: 4px solid #ffcb05;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        @keyframes loading-stripes {
          from { background-position: 0 0; }
          to { background-position: 80px 0; }
        }
        .loading-stripes-bg {
          animation: loading-stripes 1.2s linear infinite;
        }

        @keyframes heartbeat {
          0% { transform: scale(1); }
          50% { transform: scale(1.03); }
          100% { transform: scale(1); }
        }
        .heartbeat {
          animation: heartbeat 2s ease-in-out infinite;
        }

        /* Pokémon-Style Swaying Character Animation (White version) */
        @keyframes sway-char-anim {
          0%, 100% { 
            transform: translate(-1px, 0) rotate(-3deg); 
            color: #ffffff; 
            text-shadow: 2px 2px 0 #2a75bb, 4px 4px 0 #1e568a;
          }
          50% { 
            transform: translate(1px, -10px) rotate(3deg); 
            color: #ffffff;
            text-shadow: 3px 3px 0 #2a75bb, 5px 5px 0 #1e568a, 0 0 10px rgba(255,255,255,0.4);
          }
        }
        .sway-char {
          animation: sway-char-anim 3s ease-in-out infinite;
        }

        @keyframes option-pulse {
          0% { transform: scale(1); background-color: #f5f5f5; }
          50% { transform: scale(1.01); background-color: #fff; }
          100% { transform: scale(1); background-color: #f5f5f5; }
        }
        .option-dynamic {
          animation: option-pulse 4s ease-in-out infinite;
        }
        
        .option-dynamic:hover {
          background-color: #ffcb05 !important;
          animation: none;
          transform: translateY(-2px);
          boxShadow: 4px 4px 0 rgba(0,0,0,0.3);
        }

        /* Ending Screen Animations */
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
          100% { transform: translateY(0px); }
        }
        @keyframes float-alt {
          0% { transform: translateY(-4px); }
          50% { transform: translateY(4px); }
          100% { transform: translateY(-4px); }
        }
        .float-btn {
          animation: float 3s ease-in-out infinite;
        }
        .float-btn-alt {
          animation: float-alt 3.5s ease-in-out infinite;
        }
        
        @keyframes glow {
          0% { text-shadow: 0 0 2px rgba(238,21,21,0.2); }
          50% { text-shadow: 0 0 15px rgba(238,21,21,0.6); }
          100% { text-shadow: 0 0 2px rgba(238,21,21,0.2); }
        }
        .glow-text {
          animation: glow 2.5s infinite;
        }

        .float-btn:hover, .float-btn-alt:hover {
          animation-play-state: paused;
          background-color: #ffcb05 !important;
          color: #000 !important;
        }
      `}</style>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
