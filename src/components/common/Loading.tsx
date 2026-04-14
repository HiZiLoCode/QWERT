export default function Loading({ size = 24 }) {
  return (
      <img
        src="svgs/loading.svg"
        alt="loading"
        width={size}
        className="animate-spin-fast mx-auto"  // 使用自定义的旋转速度
      />
  );
}
