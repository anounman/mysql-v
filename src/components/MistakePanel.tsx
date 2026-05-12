import React from 'react';
import { SqlMistake } from '../types';

interface Props { mistakes: SqlMistake[]; }

const ICONS: Record<string, string> = { error: '🚨', warning: '⚠️', info: 'ℹ️' };

export default function MistakePanel({ mistakes }: Props) {
  if (!mistakes.length) return (
    <div className="empty-state"><div className="icon">✅</div><p>No issues detected</p></div>
  );
  return (
    <div>
      {mistakes.map((m, i) => (
        <div key={i} className={`mistake-item mistake-${m.level}`}>
          <div className="mistake-icon">{ICONS[m.level]}</div>
          <div>
            <div className="mistake-title">{m.title}</div>
            <div className="mistake-detail">{m.detail}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
