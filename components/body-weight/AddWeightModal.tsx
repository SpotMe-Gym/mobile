import { View, Text, TextInput, Modal, Pressable } from 'react-native';
import { useState } from 'react';
import { X } from 'lucide-react-native';
import { Button } from '../ui/Button';

interface AddWeightModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (weight: string, date: string) => void;
  currentWeight: string;
}

export function AddWeightModal({ visible, onClose, onSave, currentWeight }: AddWeightModalProps) {
  const [weight, setWeight] = useState(currentWeight);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const handleSave = () => {
    if (!weight) return;
    onSave(weight, date);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/80 justify-center items-center px-4">
        <View className="w-full max-w-sm bg-zinc-900 rounded-3xl p-6 border border-zinc-800">
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-white text-xl font-bold">Log Weight</Text>
            <Pressable onPress={onClose} className="p-2 -mr-2">
              <X color="#a1a1aa" size={24} />
            </Pressable>
          </View>

          <View className="mb-6">
            <Text className="text-zinc-400 text-sm mb-2 font-medium">Weight</Text>
            <View className="bg-zinc-800 rounded-xl px-4 py-3 flex-row items-center">
              <TextInput
                className="flex-1 text-white text-lg font-bold"
                value={weight}
                onChangeText={(text) => {
                  // Only allow numbers and at most one decimal place
                  if (/^\d*\.?\d{0,1}$/.test(text)) {
                    setWeight(text);
                  }
                }}
                keyboardType="decimal-pad"
                placeholder="0.0"
                placeholderTextColor="#52525b"
                autoFocus
              />
            </View>
          </View>

          {/* Date picker could go here, defaulting to today for now */}
          {/* Simple date display */}
          <View className="mb-6">
            <Text className="text-zinc-400 text-sm mb-2 font-medium">Date</Text>
            <View className="bg-zinc-800/50 rounded-xl px-4 py-3">
              <Text className="text-zinc-300">{date}</Text>
            </View>
          </View>

          <Button
            label="Save Entry"
            onPress={handleSave}
            variant="primary"
            className="w-full"
          />
        </View>
      </View>
    </Modal>
  );
}
