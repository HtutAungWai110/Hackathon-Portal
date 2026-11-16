import { descriptionBlocks } from '../../lib/description';

type DescriptionTextProps = {
  /** The plain text an admin typed into the description field. */
  text: string;
  /** Applied to every block, so the page can style it as a whole. */
  className?: string;
};

/**
 * Renders an event description as real paragraphs and lists. The text stays
 * plain: `descriptionBlocks` reads the markers an author typed, and this turns
 * them into `ul`/`ol`, so nothing the author writes is ever parsed as markup.
 */
export function DescriptionText({ text, className }: DescriptionTextProps) {
  const blocks = descriptionBlocks(text);

  return (
    <>
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;

        if (block.type === 'paragraph') {
          return (
            <p className={className} key={key}>
              {block.text}
            </p>
          );
        }

        const items = block.items.map((item, itemIndex) => (
          <li key={`${key}-${itemIndex}`}>{item}</li>
        ));

        return block.type === 'bullets' ? (
          <ul className={className} key={key}>
            {items}
          </ul>
        ) : (
          <ol className={className} key={key}>
            {items}
          </ol>
        );
      })}
    </>
  );
}
