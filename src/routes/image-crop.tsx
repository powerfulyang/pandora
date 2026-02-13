import { createFileRoute } from '@tanstack/react-router'
import ImageCropTool from '@/components/ImageCropTool'

export const Route = createFileRoute('/image-crop')({
  component: ImageCropTool,
})
