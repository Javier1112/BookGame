import type { ChangeEvent } from "react";
import RetroContainer from "@/components/RetroContainer";
import type { BookInfo } from "@/constants/books";

interface StartScreenProps {
  inputBook: string;
  onInputChange: (value: string) => void;
  onStart: (title: string) => void;
  loading: boolean;
  loadingMessage: string;
  progress: number;
  error: string | null;
  books: BookInfo[];
}

const StartScreen = ({
  inputBook,
  onInputChange,
  onStart,
  loading,
  loadingMessage,
  progress,
  error,
  books
}: StartScreenProps) => {
  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    onInputChange(event.target.value);
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        backgroundColor: "#000"
      }}
    >
      <RetroContainer>
        <div
          style={{
            textAlign: "center",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "10px"
          }}
        >
          <h1
            style={{
              fontSize: "48px",
              marginBottom: "40px",
              marginTop: "-20px",
              letterSpacing: "3px",
              display: "flex",
              justifyContent: "center",
              flexWrap: "wrap",
              filter: "drop-shadow(4px 4px 0px #2a75bb)"
            }}
          >
            {"SHNU PLAYBRARY".split("").map((char, index) => (
              <span
                key={`${char}-${index}`}
                className="sway-char"
                style={{
                  animationDelay: `${index * 0.1}s`,
                  display: char === " " ? "inline" : "inline-block"
                }}
              >
                {char === " " ? "\u00A0" : char}
              </span>
            ))}
          </h1>

          <p
            className="zh-text"
            style={{ fontSize: "22px", marginBottom: "30px", color: "#fff" }}
          >
            请选择任意一本书籍，开启您的冒险之旅！
          </p>

          <div style={{ display: "grid", gap: "15px", marginBottom: "25px" }}>
            {books.map((book, idx) => (
              <button
                key={book.id}
                onClick={() => onStart(book.title)}
                className="zh-text option-dynamic"
                style={{
                  padding: "16px",
                  backgroundColor: "#fff",
                  color: "#000",
                  border: "4px solid #000",
                  cursor: "pointer",
                  fontSize: "20px",
                  boxShadow: "6px 6px 0 rgba(0,0,0,0.5)",
                  animationDelay: `${idx * 0.4}s`
                }}
                disabled={loading}
              >
                《{book.title}》
              </button>
            ))}
          </div>

          <div style={{ padding: "0 10px", marginBottom: "10px" }}>
            <input
              type="text"
              placeholder="或者输入其他书名+作者"
              value={inputBook}
              onChange={handleInputChange}
              className="zh-text"
              style={{
                width: "100%",
                padding: "16px",
                fontSize: "20px",
                border: "4px solid #000",
                marginBottom: "15px",
                backgroundColor: "#fff",
                color: "#000",
                boxSizing: "border-box",
                textAlign: "center"
              }}
            />
            <button
              onClick={() => onStart(inputBook)}
              className="zh-text heartbeat"
              style={{
                width: "100%",
                padding: "18px",
                backgroundColor: "#ee1515",
                color: "#fff",
                border: "4px solid #000",
                cursor: "pointer",
                fontSize: "22px",
                fontWeight: "bold",
                boxShadow: "6px 6px 0 rgba(0,0,0,0.5)"
              }}
              disabled={loading || !inputBook.trim()}
            >
              开始探险 (START)
            </button>
          </div>

          {loading && (
            <div style={{ width: "85%", margin: "20px auto 0" }}>
              <p
                className="zh-text heartbeat"
                style={{
                  color: "#ffcb05",
                  fontSize: "18px",
                  marginBottom: "15px",
                  fontWeight: "bold"
                }}
              >
                {loadingMessage}
              </p>

              <div
                style={{
                  height: "36px",
                  border: "4px solid #000",
                  backgroundColor: "#fff",
                  padding: "4px",
                  boxShadow: "4px 4px 0 rgba(0,0,0,0.5)",
                  position: "relative",
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center"
                }}
              >
                <div
                  className="loading-stripes-bg"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    height: "100%",
                    backgroundColor: "#ee1515",
                    width: `${progress}%`,
                    backgroundImage:
                      "linear-gradient(45deg, rgba(255, 255, 255, 0.25) 25%, transparent 25%, transparent 50%, rgba(255, 255, 255, 0.25) 50%, rgba(255, 255, 255, 0.25) 75%, transparent 75%, transparent)",
                    backgroundSize: "40px 40px",
                    boxShadow: "inset 0 0 10px rgba(0,0,0,0.3)",
                    transition: "width 0.3s ease-out"
                  }}
                />

                <div
                  className="zh-text"
                  style={{
                    position: "absolute",
                    width: "100%",
                    textAlign: "center",
                    zIndex: 2,
                    color: progress > 50 ? "#fff" : "#000",
                    fontSize: "16px",
                    fontWeight: "bold",
                    textShadow: progress > 50 ? "2px 2px 0 #000" : "none",
                    left: 0
                  }}
                >
                  {Math.floor(progress)}%
                </div>
              </div>

              <p
                className="zh-text"
                style={{ color: "#aaa", fontSize: "14px", marginTop: "12px" }}
              >
                正在连接 SHNU 图书馆元宇宙...
              </p>
            </div>
          )}

          {error && (
            <div
              style={{
                marginTop: "15px",
                backgroundColor: "rgba(255,0,0,0.15)",
                border: "2px solid #ff0000",
                padding: "10px",
                borderRadius: "4px"
              }}
            >
              <p
                className="zh-text"
                style={{ color: "#ffaaaa", fontSize: "14px", margin: 0 }}
              >
                {error}
              </p>
            </div>
          )}
        </div>
      </RetroContainer>
    </div>
  );
};

export default StartScreen;
