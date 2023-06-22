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

    it('should redirect to new url on click', () => {
        const { getByTestId } = render(
            <Menu
                config={[
                    { name: '', child: [{ label: 'test', link: '/test' }] },
                ]}
            />,
        );
        const option = getByTestId(`menu-test`);
        fireEvent.click(option);
        expect(window.open).toHaveBeenCalledTimes(1);
    });
    it('should redirect to external url on click', () => {
        const { getByTestId } = render(
            <Menu
                config={[
                    {
                        name: '',
                        child: [
                            { label: 'test', link: '/test', external: true },
                        ],
                    },
                ]}
            />,
        );
        const option = getByTestId(`menu-test`);
        fireEvent.click(option);
        expect(window.open).toHaveBeenCalledTimes(1);
    });
});
