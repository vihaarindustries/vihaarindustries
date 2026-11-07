'use client';
import dynamic from 'next/dynamic';
import type { SceneProps } from './Scene3D';

// three.js is only downloaded in the browser, after the page has loaded, so it never slows the first paint.
const Scene3D = dynamic(() => import('./Scene3D'), { ssr: false });
export default function Scene(props: SceneProps) { return <Scene3D {...props} />; }
