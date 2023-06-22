import React from 'react';
import renderer from 'react-test-renderer';
import { fireEvent, render } from '@testing-library/react';

import Menu from './index';

describe('Menu', () => {
    window.open = jest.fn();

    it('should renders correctly', () => {
        const tree = renderer.create(<Menu config={[]} />).toJSON();
        expect(tree).toMatchSnapshot();
    });
});
