interface AvatarProps {
  name: string;
  color: string;
  size?: number;
}

export default function Avatar({ name, color, size = 28 }: AvatarProps) {
  return (
    <div
      title={name}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.45,
        fontWeight: 700,
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
