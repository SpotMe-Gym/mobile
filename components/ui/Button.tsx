import { TouchableOpacity, Text, TouchableOpacityProps, ActivityIndicator, View } from 'react-native';

interface ButtonProps extends TouchableOpacityProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'white' | 'danger' | 'ai';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  label?: string;
  loading?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

export function Button({
  variant = 'primary',
  size = 'md',
  label,
  loading,
  className,
  disabled,
  icon,
  hitSlop = { top: 10, bottom: 10, left: 10, right: 10 },
  ...props
}: ButtonProps) {
  const isIconOnly = size === 'icon' || (!label && icon);

  const baseStyle = "rounded-xl flex-row justify-center items-center";

  const variants = {
    primary: "bg-blue-600",
    secondary: "bg-zinc-800",
    outline: "border border-zinc-700 bg-transparent",
    ghost: "bg-transparent",
    white: "bg-white",
    danger: "bg-red-500/10 border border-red-500/20",
    ai: "bg-blue-600/20 border border-blue-500/30",
  };

  const sizes = {
    sm: "px-3 py-2",
    md: "px-4 py-3",
    lg: "px-6 py-4",
    icon: "h-10 w-10",
  };

  const textStyles = {
    primary: "text-white font-bold",
    secondary: "text-white font-medium",
    outline: "text-zinc-300 font-medium",
    ghost: "text-zinc-400 font-medium",
    white: "text-black font-bold",
    danger: "text-red-500 font-bold",
    ai: "text-blue-500 font-medium",
  };

  const textSize = {
    sm: "text-xs",
    md: "text-base",
    lg: "text-lg",
    icon: "text-base",
  };

  const iconOnlyStyle = isIconOnly ? "rounded-full" : "";

  return (
    <TouchableOpacity
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${iconOnlyStyle} ${disabled ? 'opacity-50' : ''} ${className || ''}`}
      disabled={disabled || loading}
      hitSlop={hitSlop}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'danger' ? '#ef4444' : 'white'} size="small" />
      ) : isIconOnly ? (
        icon
      ) : (
        <View className="flex-row items-center gap-2">
          {icon}
          {label && <Text className={`${textStyles[variant]} ${textSize[size]}`}>{label}</Text>}
        </View>
      )}
    </TouchableOpacity>
  );
}
