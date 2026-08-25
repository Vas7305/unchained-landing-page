import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function NotFound() {
  return (
    <main
      id='main'
      className='min-h-screen flex items-center justify-center px-6 py-32 relative overflow-hidden'
    >
      <div className='absolute inset-0 blueprint-grid' aria-hidden='true' />

      <div className='relative max-w-xl text-center flex flex-col items-center gap-6'>
        <p className='text-xs uppercase tracking-widest text-muted-foreground font-medium'>
          404
        </p>
        <h1 className='text-4xl md:text-5xl font-extrabold tracking-tight'>
          <span className='gradient-text'>This page hasn&apos;t</span>{' '}
          <span className='text-foreground'>been built yet.</span>
        </h1>
        <p className='text-muted-foreground leading-relaxed'>
          Which, given what we do, we appreciate the irony of. Here is where to
          go instead.
        </p>
        <div className='flex flex-col sm:flex-row gap-3'>
          <Link
            href='/'
            className='group inline-flex items-center justify-center gap-2 bg-foreground text-background font-semibold px-6 py-3 rounded-xl text-sm hover:bg-foreground/90 transition-all duration-200'
          >
            Back home
            <ArrowRight
              size={15}
              aria-hidden='true'
              className='group-hover:translate-x-1 transition-transform duration-200'
            />
          </Link>
          <Link
            href='/work'
            className='inline-flex items-center justify-center gap-2 glow-border bg-secondary hover:bg-accent text-foreground font-semibold px-6 py-3 rounded-xl text-sm transition-all duration-200'
          >
            Explore our work
          </Link>
        </div>
      </div>
    </main>
  );
}
