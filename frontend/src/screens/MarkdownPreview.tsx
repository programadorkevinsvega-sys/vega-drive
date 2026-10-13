import type { ReactNode } from "react";

function renderInline(source: string): ReactNode[] {
  const tokenPattern =
    /(\[[^\]]+\]\((?:https?:\/\/|mailto:)[^\s)]+\)|\x60[^\x60]+\x60|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  return source.split(tokenPattern).filter(Boolean).map((part, index) => {
    const link =
      /^\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^\s)]+)\)$/.exec(part);
    if (link) {
      return (
        <a
          key={index}
          href={link[2]}
          target="_blank"
          rel="noopener noreferrer"
          referrerPolicy="no-referrer"
        >
          {link[1]}
        </a>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("\x60") && part.endsWith("\x60")) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

export function MarkdownPreview({ source }: { source: string }) {
  const lines = source.split(/\r?\n/);
  const nodes: ReactNode[] = [];
  let listItems: string[] = [];
  let codeLines: string[] | null = null;

  function flushList() {
    if (listItems.length === 0) return;
    nodes.push(
      <ul key={"list-" + nodes.length}>
        {listItems.map((item, index) => (
          <li key={index}>{renderInline(item)}</li>
        ))}
      </ul>,
    );
    listItems = [];
  }

  for (const [index, line] of lines.entries()) {
    if (line.trimStart().startsWith("\x60\x60\x60")) {
      flushList();
      if (codeLines === null) {
        codeLines = [];
      } else {
        nodes.push(
          <pre key={"code-" + index}>
            <code>{codeLines.join("\n")}</code>
          </pre>,
        );
        codeLines = null;
      }
      continue;
    }

    if (codeLines !== null) {
      codeLines.push(line);
      continue;
    }

    const listItem = /^\s*[-*+]\s+(.+)$/.exec(line);
    if (listItem) {
      listItems.push(listItem[1]);
      continue;
    }

    flushList();
    if (!line.trim()) continue;

    if (/^---+$/.test(line.trim())) {
      nodes.push(<hr key={index} />);
      continue;
    }

    if (/^>\s?/.test(line)) {
      nodes.push(
        <blockquote key={index}>
          {renderInline(line.replace(/^>\s?/, ""))}
        </blockquote>,
      );
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (!heading) {
      nodes.push(<p key={index}>{renderInline(line)}</p>);
      continue;
    }

    const content = renderInline(heading[2]);
    switch (heading[1].length) {
      case 1:
        nodes.push(<h1 key={index}>{content}</h1>);
        break;
      case 2:
        nodes.push(<h2 key={index}>{content}</h2>);
        break;
      case 3:
        nodes.push(<h3 key={index}>{content}</h3>);
        break;
      case 4:
        nodes.push(<h4 key={index}>{content}</h4>);
        break;
      case 5:
        nodes.push(<h5 key={index}>{content}</h5>);
        break;
      default:
        nodes.push(<h6 key={index}>{content}</h6>);
    }
  }

  if (codeLines !== null) {
    nodes.push(
      <pre key="code-final">
        <code>{codeLines.join("\n")}</code>
      </pre>,
    );
  }
  flushList();

  return <article className="vd-preview__markdown">{nodes}</article>;
}
