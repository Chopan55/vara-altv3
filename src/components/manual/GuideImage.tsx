'use client'

import { useRef } from 'react'

export function GuideImage({ src, alt }: { src: string; alt: string }) {
  const dialog = useRef<HTMLDialogElement>(null)

  return (
    <div className="mt-3 max-w-xl">
      <button type="button" onClick={() => dialog.current?.showModal()}
        className="block w-full rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
        aria-haspopup="dialog">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="w-full rounded-xl border border-line shadow-sm" />
        <span className="mt-1 block text-xs font-semibold text-brand-800 underline print:hidden">Ampliar captura</span>
      </button>
      <dialog ref={dialog} aria-label={alt} className="m-auto max-h-[90dvh] w-[94vw] max-w-3xl overflow-auto rounded-2xl bg-white p-3 shadow-xl backdrop:bg-slate-950/70 print:hidden">
        <form method="dialog" className="sticky top-0 z-10 mb-2 flex justify-end">
          <button className="min-h-11 rounded-xl bg-brand-700 px-4 font-semibold text-white">Cerrar captura</button>
        </form>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} loading="lazy" className="mx-auto w-full rounded-xl" />
      </dialog>
    </div>
  )
}
