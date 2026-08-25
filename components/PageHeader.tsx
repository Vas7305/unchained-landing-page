export default function PageHeader({
  eyebrow,
  title,
  accent,
  lede,
  children,
}: {
  eyebrow: string;
  title: string;
  accent?: string;
  lede?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className='relative overflow-hidden px-6 pt-36 pb-16 md:pt-44 md:pb-20'>
      <div className='absolute inset-0 blueprint-grid' aria-hidden='true' />

      <div className='relative max-w-5xl mx-auto'>
        <p className='text-xs uppercase tracking-widest text-muted-foreground mb-4 font-medium'>
          {eyebrow}
        </p>
        <h1 className='text-4xl sm:text-5xl md:text-6xl font-extrabold leading-[1.05] tracking-tight max-w-3xl'>
          <span className='gradient-text'>{title}</span>
          {accent && (
            <>
              {' '}
              <span className='text-foreground'>{accent}</span>
            </>
          )}
        </h1>
        {lede && (
          <p className='mt-6 max-w-2xl text-lg text-muted-foreground leading-relaxed'>
            {lede}
          </p>
        )}
        {children && <div className='mt-8'>{children}</div>}
      </div>
    </section>
  );
}
