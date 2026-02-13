import { createFileRoute } from '@tanstack/react-router'
import ImageCropTool from '@/components/ImageCropTool'

export const Route = createFileRoute('/image-crop')({
  component: ImageCropTool,
  head: () => ({
    meta: [
      {
        title: 'Pandora Crop - Chrome Web Store Image Generator',
      },
      {
        name: 'description',
        content:
          '快速导出 Chrome Web Store 需要的图标、宣传图和截图。基于 WASM 的本地图片处理工具，隐私安全。',
      },
    ],
  }),
})
