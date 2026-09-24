import React from 'react';
import { isVariableBinding, type ValidationRule, type ValidateOnEvent } from '@kubuild/schema';
import {
  FormButtonSubmitNode,
  FormFileUploadNode,
  FormRadioGroupNode,
  FormRadioNode,
  FormSwitchNode,
} from '../nodes';
import type { RenderNodeContentOptions } from './render-node-content';

const str = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

/**
 * Registered form types beyond the basic input set (STORA-531):
 * `switch`, `file-upload`, `radio-group`, `radio-item`, `button-submit`.
 */
export function renderExtendedFormNode(options: RenderNodeContentOptions): React.ReactElement | null {
  const {
    node,
    domId,
    styles,
    resolvedProps,
    props,
    context,
    mode,
    document,
    onDiagnostic,
    onActionDispatch,
    handleClick,
    onNodePropChange,
    childrenElements,
    selectedNodeId,
  } = options;
  const isNodeSelected = node.id === selectedNodeId;
  const labelEditable = mode === 'editor' && isNodeSelected && !isVariableBinding(props.label);
  const rules =
    (node.formConfig?.rules as ValidationRule[]) ||
    (resolvedProps.rules as ValidationRule[]) ||
    (props.rules as ValidationRule[]) ||
    [];
  const validateOn = (resolvedProps.validateOn as ValidateOnEvent) || (props.validateOn as ValidateOnEvent);
  const required = resolvedProps.required === true;
  const disabled = resolvedProps.disabled === true;
  const actionProps = {
    actions: node.actions,
    nodeId: node.id,
    document,
    renderContext: context,
    onDiagnostic,
    onActionDispatch,
  };

  switch (node.type) {
    case 'switch': {
      const size = str(resolvedProps.switchSize);
      return (
        <FormSwitchNode
          id={domId}
          name={str(resolvedProps.name)}
          label={String(resolvedProps.label ?? 'Switch')}
          value={resolvedProps.value !== undefined ? String(resolvedProps.value) : undefined}
          defaultChecked={resolvedProps.defaultChecked === true}
          switchSize={size === 'sm' || size === 'lg' ? size : 'md'}
          required={required}
          disabled={disabled}
          helperText={str(resolvedProps.helperText)}
          ariaLabel={str(resolvedProps.ariaLabel)}
          rules={rules}
          validateOn={validateOn}
          style={styles}
          onClick={handleClick}
          dataKubuildNode={node.id}
          isEditable={labelEditable}
          onNodePropChange={onNodePropChange}
          {...actionProps}
        />
      );
    }
    case 'file-upload': {
      const maxFileSize = typeof resolvedProps.maxFileSize === 'number' ? resolvedProps.maxFileSize : undefined;
      return (
        <FormFileUploadNode
          id={domId}
          name={str(resolvedProps.name)}
          label={String(resolvedProps.label ?? '')}
          accept={str(resolvedProps.accept)}
          maxFileSize={maxFileSize}
          multiple={resolvedProps.multiple === true}
          showPreview={resolvedProps.showPreview !== false}
          required={required}
          disabled={disabled}
          helperText={str(resolvedProps.helperText)}
          ariaLabel={str(resolvedProps.ariaLabel)}
          rules={rules}
          validateOn={validateOn}
          style={styles}
          onClick={handleClick}
          mode={mode}
          dataKubuildNode={node.id}
          isEditable={labelEditable}
          onNodePropChange={onNodePropChange}
          {...actionProps}
        />
      );
    }
    case 'radio-group': {
      const explicitDefault = str(resolvedProps.defaultSelected);
      const childDefault = node.children
        ?.find((child) => child.props?.defaultChecked === true && typeof child.props?.value === 'string')
        ?.props?.value as string | undefined;
      return (
        <FormRadioGroupNode
          id={domId}
          name={str(resolvedProps.name)}
          defaultSelected={explicitDefault || childDefault}
          required={required}
          disabled={disabled}
          orientation={resolvedProps.orientation === 'horizontal' ? 'horizontal' : 'vertical'}
          helperText={str(resolvedProps.helperText)}
          ariaLabel={str(resolvedProps.ariaLabel)}
          style={styles}
          onClick={handleClick}
          dataKubuildNode={node.id}
        >
          {childrenElements}
        </FormRadioGroupNode>
      );
    }
    case 'radio-item': {
      return (
        <FormRadioNode
          id={domId}
          name={str(resolvedProps.name)}
          label={String(resolvedProps.label ?? 'Radio')}
          value={resolvedProps.value !== undefined ? String(resolvedProps.value) : 'option'}
          defaultChecked={resolvedProps.defaultChecked === true}
          required={required}
          disabled={disabled}
          rules={rules}
          validateOn={validateOn}
          style={styles}
          onClick={handleClick}
          dataKubuildNode={node.id}
          isEditable={labelEditable}
          onNodePropChange={onNodePropChange}
          {...actionProps}
        />
      );
    }
    case 'button-submit': {
      const rawType = resolvedProps.buttonType ?? props.buttonType;
      const buttonType =
        rawType === 'reset' || rawType === 'button' ? rawType : ('submit' as const);
      const label = String(resolvedProps.label ?? resolvedProps.text ?? 'Submit');
      return (
        <FormButtonSubmitNode
          id={domId}
          label={label}
          loadingText={str(resolvedProps.loadingText)}
          showSpinner={resolvedProps.showSpinner !== false}
          autoDisableOnSubmit={resolvedProps.autoDisableOnSubmit !== false}
          buttonType={mode === 'editor' ? 'button' : buttonType}
          variant={str(resolvedProps.variant)}
          disabled={disabled}
          prefixIcon={str(resolvedProps.prefixIcon)}
          suffixIcon={str(resolvedProps.suffixIcon)}
          ariaLabel={str(resolvedProps.ariaLabel)}
          title={str(resolvedProps.title)}
          style={styles}
          onClick={disabled ? undefined : handleClick}
          node={node}
          document={document}
          renderContext={context}
          onDiagnostic={onDiagnostic}
          onActionDispatch={onActionDispatch}
          dataKubuildNode={node.id}
          isEditable={labelEditable && !isVariableBinding(props.text)}
          onNodePropChange={onNodePropChange}
        />
      );
    }
    default:
      return null;
  }
}
