// The upload endpoint accepts the finished, shareable MPDF only.
export async function uploadSharingCopy(bytes, translate, signal) {
  const response = await fetch('/api/upload', {
    method:'POST', headers:{'content-type':'application/pdf'}, body:bytes, signal
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.id || !data?.url) {
    const messages = {
      link_disabled:translate('링크 저장소를 아직 사용할 수 없어요. 공유용 MPDF를 파일로 보내 주세요.', 'Link storage is unavailable. Send the sharing MPDF as a file.', 'リンクの保存先が使えません。共有用MPDFをファイルで送ってください。'),
      embedded_audio:translate('파일 음원이 포함된 악보는 MPDF 파일로 공유해 주세요.', 'Send scores with embedded audio as MPDF files.', '音源を埋め込んだ楽譜はMPDFファイルで送ってください。'),
      private_original:translate('편집용 원본이 포함되어 있어요. 공유본을 저장해 주세요.', 'Save a sharing copy without private editing sources.', '編集用データを除いた共有用コピーを保存してください。'),
      unsupported_attachment:translate('링크로 보낼 수 없는 첨부가 있어요. MPDF 파일로 공유해 주세요.', 'An attachment requires file sharing. Send the MPDF file.', 'リンクに対応しない添付があります。MPDFファイルで送ってください。'),
      too_large:translate('링크 공유는 20MB까지입니다. MPDF 파일로 공유해 주세요.', 'Link sharing supports up to 20 MB. Send the MPDF file.', 'リンク共有は20 MBまでです。MPDFファイルで送ってください。')
    }
    throw new Error(messages[data?.error] || translate('공유 링크를 만들지 못했어요. 다시 시도해 주세요.', 'Could not create the sharing link. Please try again.', '共有リンクを作成できませんでした。もう一度お試しください。'))
  }
  return data
}
