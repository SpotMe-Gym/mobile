import { TouchableOpacity, Text, TouchableOpacityProps, ActivityIndicator } from 'react-native';

interface ButtonProps extends TouchableOpacityProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'white';
  size?: 'sm' | 'md' | 'lg';
  label: string;
  loading?: boolean;
  className?: string;
}

export function Button({
  variant = 'primary',
  size = 'md',
  label,
  loading,
  className,
  disabled,
  ...props
}: ButtonProps) {

  const baseStyle = "rounded-xl flex-row justify-center items-center";

  const variants = {
    primary: "bg-blue-600",
    secondary: "bg-zinc-800",
    outline: "border border-zinc-700 bg-transparent",
    ghost: "bg-transparent",
    white: "bg-white",
  };

  const sizes = {
    sm: "px-3 py-2",
    md: "px-4 py-3",
    lg: "px-6 py-4",
  };

  const textStyles = {
    primary: "text-white font-bold",
    secondary: "text-white font-medium",
    outline: "text-zinc-300 font-medium",
    ghost: "text-zinc-400 font-medium",
    white: "text-black font-bold",
  };

  // Size text adjustment
  const textSize = {
    sm: "text-xs",
    md: "text-base",
    lg: "text-lg"
  };

  return (
    <TouchableOpacity
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${disabled ? 'opacity-50' : ''} ${className || ''}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color="white" size="small" />
      ) : (
        <Text className={`${textStyles[variant]} ${textSize[size]}`}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}
