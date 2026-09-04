import { isVariableBinding } from '@kubuild/schema';
import { ComponentDefinition } from '../../registry';
import {
  ariaLabelTrait,
  autoplayTrait,
  controlsTrait,
  idTrait,
  loopTrait,
  mutedTrait,
  posterTrait,
  srcTrait,
  titleTrait,
} from '../../traits';

export const videoDefinition: ComponentDefinition = {
  type: 'video',
  label: 'Video',
  category: 'media',
  icon: 'video',
  acceptsChildren: false,
  defaultProps: {
    src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    provider: 'auto',
    poster: '',
    controls: true,
    autoplay: false,
    loop: false,
    muted: false,
    aspectRatio: '16:9',
  },
  propFields: [
    {
      name: 'src',
      label: 'Video URL (HTML5, YouTube, Vimeo)',
      type: 'string',
      defaultValue: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    },
    {
      name: 'provider',
      label: 'Provider',
      type: 'select',
      defaultValue: 'auto',
      options: [
        { label: 'Auto Detect', value: 'auto' },
        { label: 'HTML5 Video', value: 'html5' },
        { label: 'YouTube Embed', value: 'youtube' },
        { label: 'Vimeo Embed', value: 'vimeo' },
      ],
    },
    { name: 'poster', label: 'Poster Image URL', type: 'string', defaultValue: '' },
    { name: 'controls', label: 'Show Controls', type: 'boolean', defaultValue: true },
    { name: 'autoplay', label: 'Autoplay', type: 'boolean', defaultValue: false },
    { name: 'loop', label: 'Loop', type: 'boolean', defaultValue: false },
    { name: 'muted', label: 'Muted', type: 'boolean', defaultValue: false },
    {
      name: 'aspectRatio',
      label: 'Aspect Ratio',
      type: 'select',
      defaultValue: '16:9',
      options: [
        { label: '16:9 (Widescreen)', value: '16:9' },
        { label: '4:3 (Standard)', value: '4:3' },
        { label: '1:1 (Square)', value: '1:1' },
        { label: '9:16 (Vertical)', value: '9:16' },
        { label: 'Auto', value: 'auto' },
      ],
    },
  ],
  traits: [
    srcTrait(),
    posterTrait(),
    controlsTrait(),
    autoplayTrait(),
    loopTrait(),
    mutedTrait(),
    idTrait(),
    titleTrait(),
    ariaLabelTrait({ description: 'Accessible name summarizing the video content.' }),
  ],
  validateProps: (props) => {
    const errors: string[] = [];
    if (props.src !== undefined && typeof props.src !== 'string' && !isVariableBinding(props.src)) {
      errors.push('Video "src" must be a string when provided.');
    }
    if (props.provider !== undefined && !isVariableBinding(props.provider)) {
      const allowed = ['auto', 'html5', 'youtube', 'vimeo'];
      if (typeof props.provider !== 'string' || !allowed.includes(props.provider)) {
        errors.push(`Video "provider" must be one of: ${allowed.join(', ')}.`);
      }
    }
    if (props.controls !== undefined && typeof props.controls !== 'boolean' && !isVariableBinding(props.controls)) {
      errors.push('Video "controls" must be a boolean.');
    }
    if (props.autoplay !== undefined && typeof props.autoplay !== 'boolean' && !isVariableBinding(props.autoplay)) {
      errors.push('Video "autoplay" must be a boolean.');
    }
    if (props.loop !== undefined && typeof props.loop !== 'boolean' && !isVariableBinding(props.loop)) {
      errors.push('Video "loop" must be a boolean.');
    }
    if (props.muted !== undefined && typeof props.muted !== 'boolean' && !isVariableBinding(props.muted)) {
      errors.push('Video "muted" must be a boolean.');
    }
    return errors.length > 0 ? errors : true;
  },
  defaultStyles: {
    base: {
      width: '100%',
      maxWidth: '800px',
      borderRadius: '8px',
      overflow: 'hidden',
      display: 'block',
      margin: '0 0 16px 0',
    },
  },
};
