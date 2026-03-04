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

// Condition mapping for schema.org
const conditionSchemaMap: Record<string, string> = {
  new: 'https://schema.org/NewCondition',
  like_new: 'https://schema.org/UsedCondition',
  good: 'https://schema.org/UsedCondition',
  fair: 'https://schema.org/UsedCondition',
}

export default async function ProductLayout({ params, children }: Props) {
  let productSchema: Record<string, unknown> | null = null
  let breadcrumbSchema: Record<string, unknown> | null = null
  
  try {
    const product = await prisma.product.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        title: true,
        description: true,
        valorPrice: true,
        condition: true,
        city: true,
        images: true,
        status: true,
        category: {
          select: { name: true, slug: true }
        },
        user: {
          select: { name: true }
        }
      }
    })

    if (product) {
      const imageUrl = product.images?.[0] || 'https://media.nngroup.com/media/editor/2022/01/10/homedepotsmoker.jpg'
      const categoryName = product.category?.name || 'Ürün'
      const categorySlug = product.category?.slug || 'diger'
      const sellerName = product.user?.name || 'Takas-A Kullanıcısı'
      
      // Product JSON-LD Schema
      productSchema = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.title,
        description: product.description,
        image: imageUrl,
        url: `https://takas-a.com/urun/${product.id}`,
        sku: product.id,
        category: categoryName,
        offers: {
          '@type': 'Offer',
          price: product.valorPrice,
          priceCurrency: 'VALOR',
          availability: product.status === 'active' 
            ? 'https://schema.org/InStock' 
            : 'https://schema.org/OutOfStock',
          itemCondition: conditionSchemaMap[product.condition] || 'https://schema.org/UsedCondition',
          seller: {
            '@type': 'Person',
            name: sellerName
          }
        },
        brand: {
          '@type': 'Organization',
          name: 'TAKAS-A'
        }
      }

      // BreadcrumbList JSON-LD Schema
      breadcrumbSchema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Ana Sayfa',
            item: 'https://takas-a.com'
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Ürünler',
            item: 'https://takas-a.com/urunler'
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: categoryName,
            item: `https://takas-a.com/urunler?category=${categorySlug}`
          },
          {
            '@type': 'ListItem',
            position: 4,
            name: product.title,
            item: `https://takas-a.com/urun/${product.id}`
          }
        ]
      }
    }
  } catch (error) {
    console.error('Error generating product JSON-LD:', error)
  }

  return (
    <>
      {productSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
        />
      )}
      {breadcrumbSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        />
      )}
      {children}
    </>
  )
}
