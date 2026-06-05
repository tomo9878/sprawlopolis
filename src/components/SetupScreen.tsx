import { useState } from 'react';
import type { Difficulty } from '../game/types';
import { useGameStore } from '../game/store';

export function SetupScreen() {
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [playerCount, setPlayerCount] = useState(1);
  const { initGame } = useGameStore();

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#1a1a2e', color: 'white',
    }}>
      <div style={{
        background: '#12122a', border: '2px solid #2d2d44',
        borderRadius: 12, padding: 40, minWidth: 340,
        display: 'flex', flexDirection: 'column', gap: 24,
      }}>
        <h1 style={{ margin: 0, fontSize: 28, color: '#4ecdc4', textAlign: 'center' }}>
          SPRAWLOPOLIS
        </h1>
        <p style={{ margin: 0, color: '#888', textAlign: 'center', fontSize: 13 }}>
          都市開発カードゲーム
        </p>

        {/* 難易度 */}
        <div>
          <div style={{ color: '#aaa', marginBottom: 8, fontSize: 13 }}>難易度</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['easy', 'normal', 'hard'] as Difficulty[]).map(d => (
              <button key={d} onClick={() => setDifficulty(d)} style={{
                flex: 1, padding: '8px 4px',
                background: difficulty === d ? '#2d2d44' : 'transparent',
                border: `2px solid ${difficulty === d ? '#4ecdc4' : '#333'}`,
                color: difficulty === d ? '#4ecdc4' : '#555',
                borderRadius: 6, cursor: 'pointer', fontSize: 12,
                transition: 'all 0.15s',
              }}>
                {d === 'easy' ? 'EASY\n道路タックスなし' :
                 d === 'normal' ? 'NORMAL\n標準ルール' :
                 'HARD\n1ゾーンのみ'}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: '#555', marginTop: 6 }}>
            {difficulty === 'easy' && '道路ペナルティなし。初心者向け。'}
            {difficulty === 'normal' && '独立した道路1本ごとに-1点。標準ルール。'}
            {difficulty === 'hard' && '4ゾーンのうち最大1グループのみスコア。上級者向け。'}
          </div>
        </div>

        {/* プレイヤー数 */}
        <div>
          <div style={{ color: '#aaa', marginBottom: 8, fontSize: 13 }}>プレイヤー数</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[1, 2, 3, 4].map(n => (
              <button key={n} onClick={() => setPlayerCount(n)} style={{
                flex: 1, padding: 8,
                background: playerCount === n ? '#2d2d44' : 'transparent',
                border: `2px solid ${playerCount === n ? '#4ecdc4' : '#333'}`,
                color: playerCount === n ? '#4ecdc4' : '#555',
                borderRadius: 6, cursor: 'pointer', fontSize: 14,
              }}>
                {n}
              </button>
            ))}
          </div>
          {playerCount === 1 && (
            <div style={{ fontSize: 10, color: '#555', marginTop: 4 }}>ソロ: 手札2枚で開始</div>
          )}
        </div>

        {/* スタートボタン */}
        <button onClick={() => initGame(difficulty, playerCount)} style={{
          padding: '14px 0', fontSize: 16, fontWeight: 'bold',
          background: '#4ecdc4', color: '#1a1a2e',
          border: 'none', borderRadius: 8, cursor: 'pointer',
          transition: 'opacity 0.15s',
        }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          ゲームスタート
        </button>
      </div>
    </div>
  );
}
