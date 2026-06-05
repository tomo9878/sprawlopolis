import { useGameStore } from '../game/store';
import { CardSvg } from './CardSvg';

const ZONE_COLOR = { C: '#5b9bd5', P: '#70ad47', I: '#8c8c8c', R: '#ed7d31' } as const;
const ZONE_JP   = { C: '商業', P: '公園', I: '工業', R: '住宅' } as const;

function ScoreRow({ label, value, sub }: { label: string; value: number; sub?: string }) {
  const color = value > 0 ? '#4ecdc4' : value < 0 ? '#ff6b6b' : '#888';
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '5px 0', borderBottom: '1px solid #2d2d44' }}>
      <div>
        <span style={{ color: '#ccc', fontSize: 13 }}>{label}</span>
        {sub && <span style={{ color: '#555', fontSize: 11, marginLeft: 8 }}>{sub}</span>}
      </div>
      <span style={{ color, fontWeight: 'bold', fontSize: 15, minWidth: 40, textAlign: 'right' }}>
        {value > 0 ? '+' : ''}{value}
      </span>
    </div>
  );
}

export function ScoreModal() {
  const { state, scoreBreakdown, resetGame } = useGameStore();
  if (!state || state.phase !== 'scoring' || !scoreBreakdown) return null;

  const { win, total, targetScore, blockScore, roadTax,
          conditionScores, detail } = scoreBreakdown;

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.82)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: '#12122a',
        border: `3px solid ${win ? '#70ad47' : '#ff6b6b'}`,
        borderRadius: 16,
        padding: '28px 32px',
        minWidth: 480,
        maxWidth: 560,
        maxHeight: '90vh',
        overflow: 'auto',
        display: 'flex', flexDirection: 'column', gap: 20,
        boxShadow: `0 0 60px ${win ? '#70ad4740' : '#ff6b6b40'}`,
      }}>

        {/* ヘッダー */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 4 }}>{win ? '🏆' : '💀'}</div>
          <div style={{
            fontSize: 32, fontWeight: 'bold',
            color: win ? '#70ad47' : '#ff6b6b',
            letterSpacing: 2,
          }}>
            {win ? 'CITY APPROVED!' : 'CITY REJECTED'}
          </div>
          <div style={{ color: '#888', fontSize: 13, marginTop: 6 }}>
            {win ? '市の要件を達成しました！' : 'スコアが足りませんでした'}
          </div>
        </div>

        {/* スコアサマリー */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 32,
          padding: '16px 0', borderTop: '1px solid #2d2d44', borderBottom: '1px solid #2d2d44',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#888', fontSize: 12 }}>最終スコア</div>
            <div style={{
              fontSize: 44, fontWeight: 'bold',
              color: win ? '#70ad47' : '#ff6b6b',
            }}>{total}</div>
          </div>
          <div style={{ color: '#444', fontSize: 28, alignSelf: 'center' }}>vs</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#888', fontSize: 12 }}>ターゲット</div>
            <div style={{ fontSize: 44, fontWeight: 'bold', color: '#ffe66d' }}>{targetScore}</div>
          </div>
        </div>

        {/* スコアリング条件3枚 */}
        <div>
          <div style={{ color: '#4ecdc4', fontSize: 13, fontWeight: 'bold', marginBottom: 10 }}>
            スコアリング条件
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {state.scoringCards.map((card, i) => (
              <div key={card.id} style={{
                display: 'flex', gap: 12, alignItems: 'center',
                background: '#1a1a3a', borderRadius: 8, padding: '8px 10px',
              }}>
                <CardSvg card={card} rotation={0} width={44} height={60}
                  showBack />
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#ffe66d', fontSize: 12, fontWeight: 'bold' }}>
                    #{card.id} {card.name}
                  </div>
                  <div style={{ color: '#777', fontSize: 10, marginTop: 2, lineHeight: 1.3 }}>
                    {card.scoring.description}
                  </div>
                </div>
                <div style={{
                  fontSize: 20, fontWeight: 'bold', minWidth: 44, textAlign: 'right',
                  color: conditionScores[i] >= 0 ? '#4ecdc4' : '#ff6b6b',
                }}>
                  {conditionScores[i] >= 0 ? '+' : ''}{conditionScores[i]}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ブロック内訳 */}
        <div>
          <div style={{ color: '#4ecdc4', fontSize: 13, fontWeight: 'bold', marginBottom: 8 }}>
            ブロックスコア
          </div>
          {(['R','C','I','P'] as const).map(z => (
            <ScoreRow key={z}
              label={`最大${ZONE_JP[z]}グループ`}
              value={detail.largestGroups[z]}
              sub={`(${ZONE_JP[z]})`}
            />
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between',
            padding: '6px 0', marginTop: 2 }}>
            <span style={{ color: '#aaa', fontWeight: 'bold' }}>ブロック計</span>
            <span style={{ color: '#4ecdc4', fontWeight: 'bold', fontSize: 16 }}>+{blockScore}</span>
          </div>
        </div>

        {/* 道路タックス */}
        <div>
          <div style={{ color: '#4ecdc4', fontSize: 13, fontWeight: 'bold', marginBottom: 8 }}>
            道路タックス
          </div>
          <ScoreRow
            label={`独立した道路 ${detail.roadCount}本`}
            value={roadTax}
            sub={state.difficulty === 'easy' ? '(EASYモード: 0)' : `(${detail.roadCount}本 × -1)`}
          />
        </div>

        {/* 合計 */}
        <div style={{
          background: win ? '#1a3a1a' : '#2a1a1a',
          border: `1px solid ${win ? '#70ad47' : '#ff6b6b'}`,
          borderRadius: 10, padding: '12px 16px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ color: '#888', fontSize: 12 }}>条件合計</div>
            <div style={{ color: '#4ecdc4', fontSize: 13 }}>
              {conditionScores.reduce((a,b)=>a+b,0) >= 0 ? '+' : ''}{conditionScores.reduce((a,b)=>a+b,0)}
            </div>
          </div>
          <div style={{ color: '#555', fontSize: 18 }}>+</div>
          <div>
            <div style={{ color: '#888', fontSize: 12 }}>ブロック</div>
            <div style={{ color: '#4ecdc4', fontSize: 13 }}>+{blockScore}</div>
          </div>
          <div style={{ color: '#555', fontSize: 18 }}>+</div>
          <div>
            <div style={{ color: '#888', fontSize: 12 }}>道路</div>
            <div style={{ color: roadTax < 0 ? '#ff6b6b' : '#888', fontSize: 13 }}>{roadTax}</div>
          </div>
          <div style={{ color: '#555', fontSize: 18 }}>=</div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#888', fontSize: 12 }}>最終スコア</div>
            <div style={{
              fontSize: 28, fontWeight: 'bold',
              color: win ? '#70ad47' : '#ff6b6b',
            }}>{total}</div>
          </div>
        </div>

        {/* ボタン */}
        <button onClick={resetGame} style={{
          padding: '14px 0', fontSize: 15, fontWeight: 'bold',
          background: win ? '#70ad47' : '#4ecdc4',
          color: '#1a1a2e', border: 'none', borderRadius: 8,
          cursor: 'pointer', letterSpacing: 1,
        }}>
          もう一度プレイ
        </button>
      </div>
    </div>
  );
}
