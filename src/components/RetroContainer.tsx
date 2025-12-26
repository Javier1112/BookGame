import type { PropsWithChildren } from "react";

const RetroContainer = ({ children }: PropsWithChildren) => (
  <div
    style={{
      maxWidth: "500px",
      margin: "10px auto",
      padding: "15px",
      border: "4px solid #fff",
      borderRadius: "12px",
      backgroundColor: "#385848",
      boxShadow: "0 0 0 4px #000, 8px 8px 0 rgba(0,0,0,0.5)",
      display: "flex",
      flexDirection: "column",
      height: "calc(100vh - 20px)",
      position: "relative",
      overflowY: "auto"
    }}
  >
    {children}
  </div>
);

export default RetroContainer;
