import ImageCropTool from '@/components/ImageCropTool'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/image-crop')({
  ssr: false,
  component: ImageCropTool
})
