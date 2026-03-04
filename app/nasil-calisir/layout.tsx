import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Nasıl Çalışır - Takas-A Kullanım Rehberi',
  description: 'Takas-A nasıl kullanılır? Adım adım takas yapma rehberi. Ürün ekle, VALOR değeri al, takas teklifi gönder, anlaş ve takasla!',
  keywords: ['takas nasıl yapılır', 'takas-a kullanımı', 'takas rehberi', 'VALOR sistemi', 'ücretsiz takas'],
  openGraph: {
    title: 'Nasıl Çalışır | TAKAS-A',
    description: 'Takas-A platformunu kullanmayı öğrenin. Adım adım takas rehberi.',
    type: 'website',
  },
}

// HowTo JSON-LD Structured Data
const howToSchema = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'TAKAS-A\'da Nasıl Takas Yapılır?',
  description: 'Global ücretsiz takas platformu TAKAS-A\'da eşya takası yapmanın 5 kolay adımı. Para ödemeden, Valor sistemi ile güvenli takas yapın.',
  image: 'https://i.ytimg.com/vi/PU2RoBaelDc/maxresdefault.jpg',
  totalTime: 'PT10M',
  estimatedCost: {
    '@type': 'MonetaryAmount',
    currency: 'TRY',
    value: '0'
  },
  supply: [
    {
      '@type': 'HowToSupply',
      name: 'Takas etmek istediğiniz eşya'
    }
  ],
  tool: [
    {
      '@type': 'HowToTool',
      name: 'Akıllı telefon veya bilgisayar'
    },
    {
      '@type': 'HowToTool',
      name: 'İnternet bağlantısı'
    }
  ],
  step: [
    {
      '@type': 'HowToStep',
      position: 1,
      name: 'Kayıt Ol ve Ürünlerini Listele',
      text: 'TAKAS-A\'ya ücretsiz üye olun. E-posta adresinizle kayıt olun ve 50 Valor hoş geldin bonusu kazanın. Hesabınızı oluşturduktan sonra takas etmek istediğiniz ürünleri fotoğraflarıyla ekleyin.',
      url: 'https://takas-a.com/kayit',
      image: 'https://www.shutterstock.com/image-vector/onboarding-banner-web-icon-vector-260nw-2523551609.jpg'
    },
    {
      '@type': 'HowToStep',
      position: 2,
      name: 'Valor Değeri Belirlenir',
      text: 'Her ürüne AI destekli sistem tarafından adil bir Valor değeri atanır. Bu değer, takaslarda denge sağlar ve herkesin adaletli bir şekilde takas yapmasını garanti eder.',
      url: 'https://takas-a.com/urun-ekle'
    },
    {
      '@type': 'HowToStep',
      position: 3,
      name: 'İstediğin Ürünü Bul',
      text: 'Binlerce ürün arasından istediğinizi bulun. Kategorilere göre filtreleyin, şehir bazlı arayın veya görsel arama özelliğini kullanın. Beğendiğiniz ürüne takas teklifi gönderin.',
      url: 'https://takas-a.com/urunler'
    },
    {
      '@type': 'HowToStep',
      position: 4,
      name: 'Çoklu Takas Eşleşmesi',
      text: 'Akıllı sistem 3, 4, 5 kişilik takas zincirleri oluşturarak en uygun eşleşmeyi bulur. Doğrudan takas yapamayacağınız ürünlere bile çoklu takas ile ulaşabilirsiniz.',
      url: 'https://takas-a.com/takas-firsatlari'
    },
    {
      '@type': 'HowToStep',
      position: 5,
      name: 'QR Kod ile Teslim Al',
      text: 'Şehrinizdeki güvenli teslim noktasına gidin veya kargo ile gönderin. QR kodunuzu okutarak ürünü teslim alın ve takası onaylayın. Valor puanlarınız anında hesabınıza yansır!',
      url: 'https://takas-a.com/teslim-noktalari'
    }
  ]
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }}
      />
      {children}
    </>
  )
}
