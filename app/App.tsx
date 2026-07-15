import React, { useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";

function App() {
  const [display, setDisplay] = useState("0");
  const [expression, setExpression] = useState("");
  const [justEvaluated, setJustEvaluated] = useState(false);

  const handleInput = useCallback((val: string) => {
    if (justEvaluated) {
      if (["+", "-", "×", "÷"].includes(val)) {
        // 继续用计算结果运算
        setJustEvaluated(false);
        setExpression(display + " " + val + " ");
        setDisplay(display);
      } else if (val === "=" || val === "Enter") {
        // 重复按等号
      } else {
        setJustEvaluated(false);
        setDisplay(val);
        setExpression("");
      }
      return;
    }

    if (val === "C") {
      setDisplay("0");
      setExpression("");
      return;
    }

    if (val === "⌫") {
      setDisplay((prev) => (prev.length > 1 ? prev.slice(0, -1) : "0"));
      return;
    }

    if (val === ".") {
      setDisplay((prev) => (prev.includes(".") ? prev : prev + "."));
      return;
    }

    if (["+", "-", "×", "÷"].includes(val)) {
      setExpression((prev) => prev + display + " " + val + " ");
      setDisplay("0");
      return;
    }

    if (val === "=" || val === "Enter") {
      if (!expression) return;
      const fullExpr = expression + display;
      const result = calculate(fullExpr);
      setExpression(fullExpr + " =");
      setDisplay(result);
      setJustEvaluated(true);
      return;
    }

    // 数字
    setDisplay((prev) => (prev === "0" ? val : prev + val));
  }, [display, expression, justEvaluated]);

  const calculate = (expr: string): string => {
    try {
      // 解析表达式如 "12 + 34 × 5"
      const tokens = expr.split(" ").filter((t) => t !== "");
      // 先处理乘除
      let stack: number[] = [];
      let currentOp = "+";
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (["+", "-", "×", "÷"].includes(token)) {
          currentOp = token;
        } else {
          const num = parseFloat(token);
          if (currentOp === "+") stack.push(num);
          else if (currentOp === "-") stack.push(-num);
          else if (currentOp === "×") stack.push(stack.pop()! * num);
          else if (currentOp === "÷") {
            if (num === 0) return "不能除以0";
            stack.push(stack.pop()! / num);
          }
        }
      }
      const result = stack.reduce((a, b) => a + b, 0);
      return Number.isInteger(result) ? String(result) : parseFloat(result.toFixed(6)).toString();
    } catch {
      return "Error";
    }
  };

  // 键盘支持
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const key = e.key;
      if (key >= "0" && key <= "9") handleInput(key);
      else if (key === ".") handleInput(".");
      else if (key === "+") handleInput("+");
      else if (key === "-") handleInput("-");
      else if (key === "*") handleInput("×");
      else if (key === "/") {
        e.preventDefault();
        handleInput("÷");
      }
      else if (key === "Enter" || key === "=") {
        e.preventDefault();
        handleInput("=");
      }
      else if (key === "Backspace") {
        e.preventDefault();
        handleInput("⌫");
      }
      else if (key === "Escape" || key === "c" || key === "C") {
        handleInput("C");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleInput]);

  const buttons = [
    { label: "C", action: "C", className: "btn-clear" },
    { label: "⌫", action: "⌫", className: "btn-fn" },
    { label: "÷", action: "÷", className: "btn-operator" },
    { label: "×", action: "×", className: "btn-operator" },
    { label: "7", action: "7", className: "btn-number" },
    { label: "8", action: "8", className: "btn-number" },
    { label: "9", action: "9", className: "btn-number" },
    { label: "-", action: "-", className: "btn-operator" },
    { label: "4", action: "4", className: "btn-number" },
    { label: "5", action: "5", className: "btn-number" },
    { label: "6", action: "6", className: "btn-number" },
    { label: "+", action: "+", className: "btn-operator" },
    { label: "1", action: "1", className: "btn-number" },
    { label: "2", action: "2", className: "btn-number" },
    { label: "3", action: "3", className: "btn-number" },
    { label: "=", action: "=", className: "btn-equals" },
    { label: "0", action: "0", className: "btn-number span-two" },
    { label: ".", action: ".", className: "btn-number" },
    { label: "", action: "", className: "" }, // 占位
  ].filter((b) => b.label !== "");

  return (
    <div className="calculator">
      <div className="display">
        <div className="expression">{expression}</div>
        <div className="result">{display}</div>
      </div>
      <div className="buttons">
        {buttons.map((btn, i) => (
          <button
            key={i}
            className={btn.className}
            onClick={() => handleInput(btn.action)}
          >
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
