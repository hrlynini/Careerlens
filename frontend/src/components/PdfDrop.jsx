import { useRef, useState } from "react";
import { parsePdf } from "../api.js";
import Icon from "./Icon.jsx";

/** Drag-and-drop (or click) PDF upload that sends the file to the backend parser. */
export default function PdfDrop({ onText }) {
  const input = useRef(null);
  const [state, setState] = useState({ busy: false, msg: "", error: false, ok: false });
  const [over, setOver] = useState(false);

  async function handle(file) {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setState({ busy: false, msg: "Please choose a PDF file.", error: true });
      return;
    }
    setState({ busy: true, msg: `Reading ${file.name}…` });
    try {
      const { text, words } = await parsePdf(file);
      onText(text);
      setState({ busy: false, msg: `${file.name} · ${words} words extracted`, ok: true });
    } catch (e) {
      setState({ busy: false, msg: e.message, error: true });
    }
  }

  return (
    <div
      className={`dropzone ${over ? "over" : ""} ${state.ok ? "done" : ""}`}
      onClick={() => input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        handle(e.dataTransfer.files[0]);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
    >
      <input
        ref={input}
        type="file"
        accept="application/pdf"
        hidden
        onChange={(e) => {
          handle(e.target.files[0]);
          e.target.value = "";
        }}
      />
      <span className="dz-icon">
        {state.busy ? <span className="spinner dark" /> : <Icon name={state.ok ? "checkCircle" : "upload"} size={20} />}
      </span>
      <span className="dz-text">
        <strong>{state.ok ? "PDF loaded" : "Upload PDF"}</strong>
        <small className={state.error ? "text-danger" : ""}>
          {state.msg || "Drag & drop or click to browse · max 10 MB"}
        </small>
      </span>
    </div>
  );
}
