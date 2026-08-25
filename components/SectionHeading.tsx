export default function SectionHeading({
  eyebrow,
  title,
  accent,
  body,
  titleId,
  align = 'center',
}: {
  eyebrow: string;
  title: string;
  accent?: string;
  body?: string;
  titleId?: string;
  align?: 'center' | 'left';
}) {
  const isCentered = align === 'center';

  return (
    <div
      className={
        isCentered ? 'text-center max-w-2xl mx-auto' : 'text-left max-w-2xl'
      }
    >
      <p className='text-xs uppercase tracking-widest text-muted-foreground mb-3 font-medium'>
        {eyebrow}
      </p>
      <h2
        id={titleId}
        className='text-4xl md:text-5xl font-bold leading-[1.1] tracking-tight'
      >
        <span className='gradient-text'>{title}</span>
        {accent && (
          <>
            <br />
            <span className='text-foreground'>{accent}</span>
          </>
        )}
      </h2>
      {body && (
        <p
          className={`mt-5 text-muted-foreground text-base leading-relaxed ${
            isCentered ? 'mx-auto max-w-lg' : ''
          }`}
        >
          {body}
        </p>
      )}
    </div>
  );
}
