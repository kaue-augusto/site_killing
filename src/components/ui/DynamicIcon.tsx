import { icons, LucideProps } from 'lucide-react';

interface DynamicIconProps extends LucideProps {
  name: string;
}

export function DynamicIcon({ name, ...props }: DynamicIconProps) {
  const IconComponent = icons[name as keyof typeof icons];

  if (!IconComponent) {
    // Fallback to MessageSquare if icon not found
    const FallbackIcon = icons['MessageSquare'];
    return <FallbackIcon {...props} />;
  }

  return <IconComponent {...props} />;
}
