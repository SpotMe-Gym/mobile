import { useRef, useState } from 'react';
import { Linking, Modal, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Flashlight, FlashlightOff, ScanBarcode, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { lightImpact } from '@/lib/haptics';
import { colors } from '@/theme/colors';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { Icon } from '../ui/Icon';

interface BarcodeScannerProps {
  visible: boolean;
  onClose: () => void;
  onScanned: (code: string) => void;
}

/**
 * Full-screen scanner. Explains why the camera is needed before the system prompt, and
 * links to Settings when access was permanently denied.
 */
export function BarcodeScanner({ visible, onClose, onScanned }: BarcodeScannerProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const handled = useRef(false);

  const handleScan = ({ data }: BarcodeScanningResult) => {
    if (handled.current) return;
    handled.current = true;
    lightImpact();
    onScanned(data);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      onShow={() => {
        handled.current = false;
      }}
    >
      <View className="flex-1 bg-overlay">
        {permission?.granted ? (
          <CameraView
            style={{ flex: 1 }}
            enableTorch={torch}
            onBarcodeScanned={handleScan}
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
          >
            <View className="flex-1" style={{ paddingTop: insets.top + 8 }}>
              <View className="flex-row justify-between px-4">
                <IconButton
                  icon={torch ? FlashlightOff : Flashlight}
                  accessibilityLabel={torch ? t('food.torchOff') : t('food.torchOn')}
                  onPress={() => setTorch((v) => !v)}
                  className="bg-overlay/70"
                />
                <IconButton
                  icon={X}
                  accessibilityLabel={t('common.close')}
                  onPress={onClose}
                  className="bg-overlay/70"
                />
              </View>
              <View className="flex-1 items-center justify-center">
                <View className="h-40 w-72 rounded-xl border-2 border-foreground/60" />
                <Text className="mt-4 rounded bg-overlay/60 px-3 py-1 font-bold text-foreground">
                  {t('food.scanBarcode')}
                </Text>
              </View>
            </View>
          </CameraView>
        ) : (
          <View className="flex-1 items-center justify-center px-8" style={{ paddingTop: insets.top }}>
            <Icon icon={ScanBarcode} size={56} color={colors.accent} />
            <Text className="mt-4 text-center text-2xl font-bold text-foreground">
              {t('food.cameraExplainerTitle')}
            </Text>
            <Text className="mt-2 text-center text-base text-subtle">{t('food.cameraExplainerMessage')}</Text>
            {permission && !permission.canAskAgain ? (
              <Button
                label={t('common.openSettings')}
                variant="white"
                className="mt-8 px-8"
                onPress={() => void Linking.openSettings()}
              />
            ) : (
              <Button
                label={t('food.allowCamera')}
                variant="white"
                className="mt-8 px-8"
                onPress={() => void requestPermission()}
              />
            )}
            <Button label={t('common.cancel')} variant="ghost" className="mt-2" onPress={onClose} />
          </View>
        )}
      </View>
    </Modal>
  );
}
