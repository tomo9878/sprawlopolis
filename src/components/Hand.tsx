import { useGameStore } from '../game/store';
import { getCard } from '../game/cardData';
import { CardSvg } from './CardSvg';

export function Hand() {
  const { state, selectedCardId, rotation, selectCard, toggleRotation } = useGameStore();
  if (!state || state.phase !== 'playing') return null;

  return (
    <div style={{
      background: '#12122a',
      borderTop: '2px solid #2d2d44',
      padding: '10px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      minHeight: 120,
    }}>
      <div style={{ color: '#888', fontSize: 12, minWidth: 50, flexShrink: 0 }}>
        手札<br />
        <span style={{ color: '#4ecdc4' }}>{state.deck.length}枚残</span>
      </div>

      {/* 手札カード */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {state.hand.map(cardId => {
          const card = getCard(cardId);
          const isSelected = selectedCardId === cardId;
          const cardRotation = isSelected ? rotation : 0;
          return (
            <div
              key={cardId}
              onClick={() => selectCard(isSelected ? null : cardId)}
              style={{
                cursor: 'pointer',
                transition: 'transform 0.2s',
                transform: isSelected ? 'translateY(-10px)' : 'none',
                position: 'relative',
              }}
            >
              <CardSvg
                card={card}
                rotation={cardRotation}
                width={70} height={96}
                selected={isSelected}
                showLabel={isSelected}
                animateRotation={isSelected}
                useTexture
              />
            </div>
          );
        })}
      </div>

      {/* 回転ボタン + 説明 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginLeft: 4 }}>
        {selectedCardId !== null ? (
          <>
            <button
              onClick={toggleRotation}
              style={{
                background: rotation === 180 ? '#3a3010' : '#2d2d44',
                border: `2px solid ${rotation === 180 ? '#ffe66d' : '#4ecdc4'}`,
                color: rotation === 180 ? '#ffe66d' : '#4ecdc4',
                borderRadius: 8,
                padding: '8px 14px',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 'bold',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span style={{
                display: 'inline-block',
                transition: 'transform 0.35s',
                transform: rotation === 180 ? 'rotate(180deg)' : 'rotate(0deg)',
              }}>🔄</span>
              {rotation === 180 ? '180° 反転中' : '180° 回転'}
            </button>
            <div style={{ color: '#555', fontSize: 11, lineHeight: 1.4 }}>
              Rキーでも回転
            </div>
          </>
        ) : (
          <div style={{ color: '#555', fontSize: 12, lineHeight: 1.5 }}>
            カードをクリックして選択<br />
            ボードの＋をクリックして配置
          </div>
        )}
      </div>
    </div>
  );
}
