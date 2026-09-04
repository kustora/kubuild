import { isAssetReference, isVariableBinding } from '@kubuild/schema';
import { ComponentDefinition } from '../../registry';
import { altTrait, ariaLabelTrait, idTrait, loadingTrait, srcTrait, titleTrait } from '../../traits';

export const imageDefinition: ComponentDefinition = {
  type: 'image',
  label: 'Image',
  category: 'media',
  icon: 'image',
  acceptsChildren: false,
  capabilities: ['assetProvider'],
  defaultProps: {
    src: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop&q=80',
    alt: 'Default image',
    width: 600,
    height: 400,
  },
  propFields: [
    { name: 'src', label: 'Image URL', type: 'string' },
    { name: 'asset', label: 'Asset Reference', type: 'json' },
    { name: 'alt', label: 'Alt Text', type: 'string', defaultValue: 'Default image' },
    { name: 'width', label: 'Width', type: 'number' },
    { name: 'height', label: 'Height', type: 'number' },
  ],
  traits: [
    srcTrait(),
    altTrait({ defaultValue: 'Default image' }),
    loadingTrait(),
    idTrait(),
    titleTrait(),
    ariaLabelTrait({ description: 'Override the alt text for assistive technology (rarely needed).' }),
  ],
  validateProps: (props) => {
    const errors: string[] = [];
    const hasSrc = (typeof props.src === 'string' && props.src.trim().length > 0) || isVariableBinding(props.src);
    const hasAsset = isAssetReference(props.asset);
    if (!hasSrc && !hasAsset) {
      errors.push('Image requires either a non-empty "src" URL or a valid "asset" reference.');
    }
    const hasAlt = (typeof props.alt === 'string' && props.alt.trim().length > 0) || isVariableBinding(props.alt);
    if (!hasAlt) {
      errors.push('Image requires non-empty "alt" text.');
    }
    return errors.length > 0 ? errors : true;
  },
  defaultStyles: {
    base: {
      maxWidth: '100%',
      height: 'auto',
      borderRadius: '8px',
    },
  },
};

