'use client';

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft } from 'lucide-react';

const BackButton = () => {
  const router = useRouter()
  return (
    <button onClick={() => router.back()} className="flex space-x-2">
      <ArrowLeft />
    </button>
  )
}

export default BackButton
