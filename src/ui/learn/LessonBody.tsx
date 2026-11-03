import type { Block } from '../../core/markdown'
import { RichText } from './RichText'

/** Renders a lesson's blocks. Lessons link terms explicitly with [[...]], so no auto-linking. */
export function LessonBody({ blocks }: { blocks: Block[] }) {
  return (
    <div className="lesson-body">
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'heading':
            return <h2 key={i}>{b.text}</h2>
          case 'paragraph':
            return (
              <p key={i}>
                <RichText text={b.text} autoLink={false} />
              </p>
            )
          case 'callout':
            return (
              <p key={i} className="callout">
                <RichText text={b.text} autoLink={false} />
              </p>
            )
          case 'list':
            return (
              <ul key={i}>
                {b.items.map((item, j) => (
                  <li key={j}>
                    <RichText text={item} autoLink={false} />
                  </li>
                ))}
              </ul>
            )
          case 'table':
            return (
              <div key={i} className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {b.header.map((h, j) => (
                        <th key={j}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((row, j) => (
                      <tr key={j}>
                        {row.map((cell, k) => (
                          <td key={k}>
                            <RichText text={cell} autoLink={false} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
        }
      })}
    </div>
  )
}
