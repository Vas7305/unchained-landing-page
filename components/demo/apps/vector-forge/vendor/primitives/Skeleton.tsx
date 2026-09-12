import styles from './Skeleton.module.css';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: number;
}

export function Skeleton({ width, height = 16, radius }: SkeletonProps) {
  return (
    <div
      className={styles.skeleton}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: radius !== undefined ? `${radius}px` : undefined,
      }}
      aria-hidden="true"
    />
  );
}
