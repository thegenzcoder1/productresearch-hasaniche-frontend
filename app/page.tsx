'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace(localStorage.getItem('token') ? '/products' : '/login');
  }, [router]);
  return null;
}
