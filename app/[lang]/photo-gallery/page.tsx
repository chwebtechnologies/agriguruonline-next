import { redirect } from 'next/navigation'

export default async function PhotoGalleryRedirectPage(props: {
  params: Promise<{ lang: string }>
}) {
  const params = await props.params
  const lang = params.lang || 'en'
  redirect(`/${lang}/participation-gallery`)
}
