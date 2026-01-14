import RetroContainer from "@/components/RetroContainer";
import type { GameState } from "@/types/game";
import type { GameOption } from "@shared/game";
import { MAX_ROUNDS } from "@/constants/gameConfig";

interface GameScreenProps {
  state: GameState;
  loading: boolean;
  interactionLocked: boolean;
  lastImageUrl: string | null;
  displayedSceneDescription: string;
  revealedOptions: number;
  onRestart: () => void;
  onChoose: (option: GameOption) => void;
  error: string | null;
}

const GameScreen = ({
  state,
  loading,
  interactionLocked,
  lastImageUrl,
  displayedSceneDescription,
  revealedOptions,
  onRestart,
  onChoose,
  error
}: GameScreenProps) => {
  const imageToShow = loading ? lastImageUrl ?? state.imageUrl : state.imageUrl;
  const placeholderOptions: GameOption[] = [
    { label: "A", text: "" },
    { label: "B", text: "" },
    { label: "C", text: "" }
  ];
  const optionsToRender =
    loading || !state.options?.length ? placeholderOptions : state.options;
  const revealCount = loading ? 0 : revealedOptions;

  const renderChoices = () => {
    if (state.isGameOver) {
      return null;
    }

    return (
      <div style={{ display: "grid", gap: "5px" }}>
        {optionsToRender.map((option, idx) => {
          const isVisible = idx < revealCount;
          const isDisabled = loading || interactionLocked || !isVisible;
          return (
          <button
            key={`${option.label}-${idx}`}
            onClick={() => onChoose(option)}
            disabled={isDisabled}
            className="zh-text option-dynamic"
            style={{
              textAlign: "center",
              padding: "6px 10px",
              border: "2px solid #000",
              backgroundColor: "#f5f5f5",
              color: "#000",
              fontSize: "12px",
              cursor: isDisabled ? "default" : "pointer",
              boxShadow: "2px 2px 0 rgba(0,0,0,0.2)",
              animationDelay: `${idx * 0.8}s`
            }}
          >
            <span
              style={{
                fontWeight: "bold",
                marginRight: "5px",
                color: "#ee1515",
                opacity: isVisible ? 1 : 0
              }}
            >
              {option.label}.
            </span>
            <span style={{ opacity: isVisible ? 1 : 0 }}>
              {option.text}
            </span>
          </button>
        )})}
      </div>
    );
  };

  const renderEnding = () => {
    if (!state.isGameOver) {
      return displayedSceneDescription;
    }

    return (
      <div style={{ textAlign: "center", padding: "10px" }}>
        <p className="zh-text" style={{ marginBottom: "25px" }}>
          {displayedSceneDescription}
        </p>

        <div
          style={{
            margin: "25px 0",
            padding: "20px",
            border: "4px double #ee1515",
            backgroundColor: "#fffaf0",
            boxShadow: "4px 4px 0 rgba(0,0,0,0.1)",
            position: "relative"
          }}
        >
          <p
            className="zh-text glow-text"
            style={{
              fontSize: "22px",
              color: "#ee1515",
              fontWeight: "bold",
              margin: "0 0 10px 0"
            }}
          >
            📖 结局悬而未决...
          </p>
          <p
            className="zh-text"
            style={{ fontSize: "16px", margin: 0, color: "#444" }}
          >
            原著比游戏更加精彩！
            快来上海师范大学图书馆借阅吧。
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "20px",
            justifyContent: "center",
            marginTop: "15px"
          }}
        >
          <a
            href={state.libraryLink}
            target="_blank"
            rel="noopener noreferrer"
            className="zh-text float-btn"
            style={{
              display: "inline-block",
              padding: "14px 24px",
              backgroundColor: "#385848",
              color: "#fff",
              textDecoration: "none",
              border: "3px solid #000",
              borderRadius: "4px",
              fontSize: "16px",
              boxShadow: "4px 4px 0 rgba(0,0,0,0.3)"
            }}
          >
            前往图书馆借阅
          </a>
          <button
            onClick={onRestart}
            className="zh-text float-btn-alt"
            style={{
              padding: "14px 24px",
              backgroundColor: "#fff",
              color: "#000",
              border: "3px solid #000",
              fontSize: "16px",
              borderRadius: "4px",
              cursor: "pointer",
              boxShadow: "4px 4px 0 rgba(0,0,0,0.3)"
            }}
          >
            再玩一局
          </button>
        </div>
      </div>
    );
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
            position: "relative",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "8px",
            height: "35px"
          }}
        >
          <div
            className="zh-text"
            style={{
              fontSize: "14px",
              fontWeight: "bold",
              color: "#ffcb05",
              zIndex: 1,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "40%"
            }}
          >
            《{state.bookTitle}》
          </div>
          <div
            className="zh-text"
            style={{
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              fontSize: "16px",
              fontWeight: "bold",
              whiteSpace: "nowrap",
              color: "#fff"
            }}
          >
            进度 {state.round}/{MAX_ROUNDS}
          </div>
          <button
            onClick={onRestart}
            className="zh-text"
            style={{
              zIndex: 1,
              padding: "4px 10px",
              fontSize: "12px",
              fontWeight: "bold",
              backgroundColor: "#ee1515",
              color: "#fff",
              border: "2px solid #000",
              cursor: "pointer",
              lineHeight: "1.2",
              flexShrink: 0
            }}
          >
            退出
          </button>
        </div>

        <div
          style={{
            flex: "0 0 auto",
            marginBottom: "8px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "160px"
          }}
        >
          <div className="game-image-frame">
            {imageToShow ? (
              <img src={imageToShow} alt="Scene" className="game-image pixelart" />
            ) : null}
            {loading ? (
              <div className="game-image-loading">
                <div className="spinner" />
              </div>
            ) : null}
          </div>
        </div>

        <div
          className="zh-text"
          style={{
            backgroundColor: "#fff",
            color: "#000",
            padding: "6px 24px",
            fontSize: "13px",
            border: "2px solid #000",
            marginBottom: "8px",
            alignSelf: "center",
            fontWeight: "bold",
            boxShadow: "2px 2px 0 rgba(0,0,0,0.5)",
            whiteSpace: "nowrap"
          }}
        >
          您现在的身份是 {state.characterName}
        </div>

        <div
          style={{
            backgroundColor: "#fff",
            color: "#000",
            border: "3px solid #000",
            borderRadius: "4px",
            padding: "10px",
            minHeight: "0",
            display: "flex",
            flexDirection: "column",
            boxShadow: "4px 4px 0 rgba(0,0,0,0.2)",
            flex: "1 1 auto",
            overflow: "hidden"
          }}
        >
          <div
            className="zh-text"
            style={{
              fontSize: "14px",
              lineHeight: "1.5",
              flex: 1,
              overflow: state.isGameOver ? "auto" : "hidden",
              marginBottom: "8px",
              ...(state.isGameOver
                ? {}
                : {
                    display: "-webkit-box",
                    WebkitLineClamp: 7,
                    WebkitBoxOrient: "vertical"
                  })
            }}
          >
            {renderEnding()}
          </div>
          {renderChoices()}
          {error && (
            <p
              className="zh-text"
              style={{
                marginTop: "12px",
                color: "#e53935",
                fontSize: "14px",
                boxShadow: "0px 4px 12px 0px rgba(0, 0, 0, 0.15)",
                textAlign: "center"
              }}
            >
              {error}
            </p>
          )}
        </div>
      </RetroContainer>
    </div>
  );
};

export default GameScreen;
