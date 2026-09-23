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
