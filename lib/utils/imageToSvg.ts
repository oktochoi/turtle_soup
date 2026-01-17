/**
 * 이미지 파일을 SVG로 변환하는 유틸리티 함수
 */

/**
 * 이미지 파일을 SVG 형식으로 변환
 * @param file 이미지 파일
 * @returns SVG 파일 (Blob)
 */
export async function convertImageToSvg(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const dataUrl = e.target?.result as string;
        
        // 이미지 로드
        const img = new Image();
        img.onload = () => {
          // SVG 생성
          const svgContent = `
            <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" 
                 width="${img.width}" height="${img.height}" viewBox="0 0 ${img.width} ${img.height}">
              <image width="${img.width}" height="${img.height}" xlink:href="${dataUrl}"/>
            </svg>
          `.trim();
          
          // SVG Blob 생성
          const svgBlob = new Blob([svgContent], { type: 'image/svg+xml' });
          resolve(svgBlob);
        };
        
        img.onerror = () => {
          reject(new Error('이미지 로드 실패'));
        };
        
        img.src = dataUrl;
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('파일 읽기 실패'));
    };
    
    reader.readAsDataURL(file);
  });
}

/**
 * 이미지 파일을 SVG File 객체로 변환
 * @param file 원본 이미지 파일
 * @param fileName 파일명 (기본값: 원본 파일명의 확장자를 .svg로 변경)
 * @returns SVG File 객체
 */
export async function convertImageToSvgFile(file: File, fileName?: string): Promise<File> {
  const svgBlob = await convertImageToSvg(file);
  const svgFileName = fileName || file.name.replace(/\.[^/.]+$/, '.svg');
  return new File([svgBlob], svgFileName, { type: 'image/svg+xml' });
}

