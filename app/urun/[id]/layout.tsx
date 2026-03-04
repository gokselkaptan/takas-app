import type { Metadata, ResolvingMetadata } from 'next'
import prisma from '@/lib/db'

interface Props {
  params: { id: string }
  children: React.ReactNode
}

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const productId = params.id
  
  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        title: true,
        description: true,
        valorPrice: true,
        condition: true,
        city: true,
        district: true,
        images: true,
        category: {
          select: { name: true }
        },
        user: {
          select: { name: true }
        }
      }
    })

    if (!product) {
      return {
        title: 'Ürün Bulunamadı',
        description: 'Aradığınız ürün bulunamadı veya kaldırılmış olabilir.',
      }
    }

    const location = product.district 
      ? `${product.district}, ${product.city}` 
      : product.city
    
    const truncatedDesc = product.description.length > 160 
      ? product.description.slice(0, 157) + '...'
      : product.description
    
    const imageUrl = product.images?.[0] || '/og-image.png'
    const categoryName = product.category?.name || 'Ürün'
    const sellerName = product.user?.name || 'Satıcı'
    
    return {
      title: `${product.title} - ${categoryName} Takası`,
      description: `${truncatedDesc} | ${product.valorPrice} VALOR | ${location} | Takas-A'da ücretsiz takasla`,
      keywords: [
        product.title,
        `${categoryName} takas`,
        `${product.city} takas`,
        'ücretsiz takas',
        'ikinci el',
        'takas platformu',
        product.condition === 'new' ? 'sıfır ürün' : 'ikinci el ürün',
      ],
      openGraph: {
        title: `${product.title} | TAKAS-A`,
        description: `${truncatedDesc} | ${product.valorPrice} VALOR | ${location}`,
        type: 'website',
        images: [{
          url: imageUrl,
          width: 800,
          height: 600,
          alt: product.title,
        }],
        siteName: 'TAKAS-A',
        locale: 'tr_TR',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${product.title} | TAKAS-A`,
        description: `${truncatedDesc} | ${product.valorPrice} VALOR`,
        images: [imageUrl],
      },
      alternates: {
        canonical: `https://takas-a.com/urun/${product.id}`,
      },
      other: {
        'product:price:amount': product.valorPrice.toString(),
        'product:price:currency': 'VALOR',
        'product:condition': product.condition === 'new' ? 'new' : 'used',
        'product:availability': 'in stock',
      },
    }
  } catch (error) {
    console.error('Error generating product metadata:', error)
    return {
      title: 'Ürün Detayı - Takas-A',
      description: 'Takas-A üzerinde ürün detaylarını görüntüleyin ve ücretsiz takasa başlayın.',
    }
  }
}

export default function ProductLayout({ children }: { children: React.ReactNode }) {
  return children
}
