import React, { useState, useRef, useCallback, forwardRef } from 'react'
import {
  View, TextInput, Text, TouchableOpacity, StyleSheet,
  TextInputProps, ViewStyle, StyleProp,
} from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated'
import { Colors, Typography, BorderRadius, Spacing } from '../../constants/theme'

interface InputProps extends TextInputProps {
  label?: string
  error?: string
  hint?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  containerStyle?: StyleProp<ViewStyle>
  isPassword?: boolean
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  {
    label,
    error,
    hint,
    leftIcon,
    rightIcon,
    containerStyle,
    isPassword = false,
    style,
    onFocus,
    onBlur,
    ...props
  },
  ref
) {
  const [isFocused, setIsFocused] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const borderColor = useSharedValue(Colors.neutral[300])

  const animatedBorder = useAnimatedStyle(() => ({
    borderColor: borderColor.value,
  }))

  const handleFocus = useCallback((e: any) => {
    setIsFocused(true)
    borderColor.value = withTiming(
      error ? Colors.error : Colors.primary[500],
      { duration: 150 }
    )
    onFocus?.(e)
  }, [borderColor, error, onFocus])

  const handleBlur = useCallback((e: any) => {
    setIsFocused(false)
    borderColor.value = withTiming(
      error ? Colors.error : Colors.neutral[300],
      { duration: 150 }
    )
    onBlur?.(e)
  }, [borderColor, error, onBlur])

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text style={[styles.label, error ? styles.labelError : isFocused ? styles.labelFocused : null]}>
          {label}
        </Text>
      ) : null}

      <Animated.View style={[
        styles.inputWrapper,
        animatedBorder,
        error ? styles.inputError : null,
      ]}>
        {leftIcon ? <View style={styles.leftIcon}>{leftIcon}</View> : null}

        <TextInput
          ref={ref}
          style={[
            styles.input,
            leftIcon ? styles.inputWithLeft : null,
            (rightIcon || isPassword) ? styles.inputWithRight : null,
            style,
          ]}
          onFocus={handleFocus}
          onBlur={handleBlur}
          secureTextEntry={isPassword && !showPassword}
          placeholderTextColor={Colors.neutral[400]}
          autoCapitalize="none"
          autoCorrect={false}
          {...props}
        />

        {isPassword ? (
          <TouchableOpacity
            style={styles.rightIcon}
            onPress={() => setShowPassword(v => !v)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.togglePassword}>{showPassword ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        ) : rightIcon ? (
          <View style={styles.rightIcon}>{rightIcon}</View>
        ) : null}
      </Animated.View>

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing[4],
  },
  label: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.neutral[600],
    marginBottom: Spacing[1],
  },
  labelFocused: { color: Colors.primary[500] },
  labelError: { color: Colors.error },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: BorderRadius.base,
    backgroundColor: Colors.light.surface,
    borderColor: Colors.neutral[300],
  },
  inputError: { borderColor: Colors.error },
  input: {
    flex: 1,
    paddingVertical: 13,
    paddingHorizontal: 14,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.neutral[900],
  },
  inputWithLeft: { paddingLeft: 6 },
  inputWithRight: { paddingRight: 6 },
  leftIcon: { paddingLeft: 12 },
  rightIcon: { paddingRight: 12 },
  togglePassword: { fontSize: 18 },
  error: {
    fontSize: Typography.fontSize.xs,
    color: Colors.error,
    marginTop: 4,
    fontFamily: Typography.fontFamily.regular,
  },
  hint: {
    fontSize: Typography.fontSize.xs,
    color: Colors.neutral[500],
    marginTop: 4,
    fontFamily: Typography.fontFamily.regular,
  },
})
