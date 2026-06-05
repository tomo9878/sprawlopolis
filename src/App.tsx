import { useEffect } from 'react';
import { useGameStore } from './game/store';
import { SetupScreen } from './components/SetupScreen';
import { GameBoard } from './components/GameBoard';
import { Hand } from './components/Hand';
import { SidePanel } from './components/SidePanel';
import { ScoreModal } from './components/ScoreModal';

export default function App() {
  const { state, toggleRotation, selectedCardId } = useGameStore();

  // Rキーで回転 (Step9)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === 'r' || e.key === 'R') && selectedCardId !== null) {
        toggleRotation();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedCardId, toggleRotation]);

  if (!state) return <SetupScreen />;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'hidden',
      background: '#1a1a2e',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        background: '#0d0d1a',
        borderBottom: '2px solid #2d2d44',
        padding: '6px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        color: '#4ecdc4',
        fontSize: 14,
        fontWeight: 'bold',
        flexShrink: 0,
      }}>
        <span>SPRAWLOPOLIS</span>
        <span style={{ color: '#555', fontWeight: 'normal', fontSize: 12 }}>
          {state.city.length}/15枚配置 | 山札残{state.deck.length}枚
        </span>
        {state.phase === 'scoring' && (
          <span style={{ color: '#ffe66d', marginLeft: 'auto' }}>ゲーム終了 — 右パネルで結果確認</span>
        )}
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <GameBoard />
        <SidePanel />
      </div>

      <Hand />
      <ScoreModal />
    </div>
  );
}
