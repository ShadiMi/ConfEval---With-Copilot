import Image from 'next/image';

export default function Logo({ size = 40 }: { size?: number }) {
  return (
    <Image
      src="/sce-logo.png"
      alt="SCE Logo"
      width={size}
      height={size}
      priority
      className="rounded-full"
    />
  );
}
