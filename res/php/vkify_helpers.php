<?php

declare(strict_types=1);

if (!function_exists('vkifyFormatCount')) {
    function vkifyFormatCount(int|float $n): string
    {
        if ($n >= 1000000) {
            return round($n / 1000000, 1) . 'M';
        }
        if ($n >= 1000) {
            return round($n / 1000, 1) . 'K';
        }
        return (string) $n;
    }
}
