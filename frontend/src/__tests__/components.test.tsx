/**
 * Component integration tests for UI components.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('applies variant class', () => {
    const { container } = render(<Badge variant="success">OK</Badge>);
    expect(container.firstChild).toHaveClass('badge-success');
  });

  it('derives class from status prop', () => {
    const { container } = render(<Badge status="pending">Pending</Badge>);
    expect(container.firstChild).toHaveClass('badge-warning');
  });

  it('applies additional className', () => {
    const { container } = render(<Badge className="ml-2">Test</Badge>);
    expect(container.firstChild).toHaveClass('ml-2');
  });
});

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });

  it('applies variant class', () => {
    render(<Button variant="danger">Delete</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-danger');
  });

  it('applies size class', () => {
    render(<Button size="lg">Big</Button>);
    expect(screen.getByRole('button')).toHaveClass('px-6');
  });

  it('is disabled when isLoading', () => {
    render(<Button isLoading>Loading</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('fires onClick', () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Press</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not fire onClick when disabled', () => {
    const onClick = jest.fn();
    render(<Button disabled onClick={onClick}>No</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });
});
