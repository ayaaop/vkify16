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

if (!function_exists('vkifyGetPostLikeFaces')) {
    function vkifyGetPostLikeFaces(\openvk\Web\Models\Entities\Postable $post, ?\openvk\Web\Models\Entities\User $viewer): array
    {
        $liked = $viewer && $post->hasLikeFrom($viewer);
        $faces = $liked ? [$viewer] : [];

        foreach ($post->getLikers(1, 3) as $liker) {
            if ($viewer && $liker->getId() === $viewer->getId()) {
                continue;
            }

            $faces[] = $liker;
            if (sizeof($faces) >= 2) {
                break;
            }
        }

        return ['faces' => $faces, 'liked' => $liked];
    }
}

if (!function_exists('vkifyDocGlyph')) {
    function vkifyDocGlyph(string $ext): array
    {
        return match (strtolower($ext)) {
            'mp3', 'flac'                  => ['attach-doctype-audio', 16, 18],
            'zip', '7z', 'rar'             => ['attach-doctype-archive', 6, 30],
            'webm', 'mp4', 'avi'           => ['attach-doctype-video', 20, 14],
            'djvu', 'ps', 'pdf', 'fb2'     => ['attach-doctype-book', 20, 17],
            'sketch'                       => ['attach-doctype-sketch', 24, 20],
            default                        => ['attach-doctype-doc', 18, 18],
        };
    }
}
